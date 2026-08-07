# Design: Flexible embedding vector dimensions per Knowledge Base

## Technical Approach

Three pieces, in order of how they compose:

1. **A static model registry** in `embeddings` — the single source of truth
   mapping a model id to its provider and dimension. Nothing ever computes
   a dimension at runtime; it's looked up.
2. **The vector itself split into a physical table per distinct dimension**,
   separate from the row's metadata — pgvector's fixed-width `vector(N)`
   column means one dimension per table is the only option that keeps ANN
   indexing (HNSW) usable, but nothing else about an embedding row depends
   on its dimension. Keeping metadata (`knowledge_base_id`, `document_id`,
   `chunk_id`, `chunk_text`, `chunk_position`, `model`, timestamps) in one
   unchanged `embeddings` table and only the `vector(N)` column in
   per-dimension child tables (`embedding_vectors_{dimension}`, one row
   each, FK'd back to `embeddings.id` with `ON DELETE CASCADE`) means
   deletes, FKs, and the two existing non-vector indexes stay defined
   exactly once — only inserts and similarity search need to know which
   dimension table to touch.
3. **A per-Knowledge-Base `embeddingModel`/`embeddingStatus`** in
   `knowledge-bases` — the model becomes tenant configuration instead of a
   global env var, and a status field gates search during re-embedding.

## Model Registry

```ts
// src/contexts/embeddings/domain/constants/embedding-models-registry.constant.ts
export interface EmbeddingModelDefinition {
  id: string;          // sent to the provider as-is, e.g. "text-embedding-3-small"
  provider: string;    // informational only ("openai" | "ollama" | ...)
  dimensions: number;  // pgvector column width this model produces
}

export const EMBEDDING_MODELS_REGISTRY: readonly EmbeddingModelDefinition[] = [
  { id: 'text-embedding-3-small', provider: 'openai', dimensions: 1536 },
  { id: 'text-embedding-3-large', provider: 'openai', dimensions: 3072 },
  { id: 'text-embedding-ada-002', provider: 'openai', dimensions: 1536 },
  { id: 'nomic-embed-text',       provider: 'ollama', dimensions: 768 },
  { id: 'mxbai-embed-large',      provider: 'ollama', dimensions: 1024 },
];
```

Adding a model that reuses an already-covered dimension (e.g. another
1536-dim OpenAI-compatible model) is a one-line addition to this array —
no migration needed. Adding a model with a brand-new dimension needs both
a registry entry and a migration creating `embedding_vectors_{dimension}`
(see "Normalized storage" below); this is documented as the standard "add
a new embedding model" runbook in `embeddings/README.md`, not hidden.

`EMBEDDING_VECTOR_DIMENSIONS` (the old single hardcoded constant) is
deleted — there is no longer one global dimension.

### Resolving a model

`EmbeddingModelRegistryService` (`embeddings/domain/services/` — a plain
domain service, no I/O):

```ts
findById(modelId: string): EmbeddingModelDefinition | null
getOrThrow(modelId: string): EmbeddingModelDefinition // throws UnknownEmbeddingModelException
listAll(): readonly EmbeddingModelDefinition[]
```

### Public "list available models" query

New public, no-input query — the first transport surface this context has
ever needed (previously "no transport surface" was true; that changes
here):

```
GET  /embeddings/models        (REST)
embeddingModels: [EmbeddingModel!]!   (GraphQL)
```

Returns `EMBEDDING_MODELS_REGISTRY` verbatim (`id`, `provider`,
`dimensions`). No guard needed — this is non-sensitive, non-tenant-scoped
static configuration; it does not require a Knowledge Base API key. Used by
`knowledge-bases`' `CreateKnowledgeBase`/`ChangeKnowledgeBaseEmbeddingModel`
callers to populate a model picker and by their command handlers'
server-side validation (see "Cross-context model validation" below).

## Normalized storage: metadata table + one vector table per dimension

### Why split the vector out, not just table-per-dimension

An earlier version of this design duplicated the *entire* row shape
(`knowledge_base_id`, `document_id`, `chunk_id`, `chunk_text`,
`chunk_position`, `model`, timestamps, both FKs, both non-vector indexes)
into every per-dimension table. That works, but it means every delete path
(`deleteByDocumentId`, `deleteByKnowledgeBaseId`) has to first resolve
*which* table a row lives in before it can delete it — even though
deletion is about `document_id`/`knowledge_base_id`, never about the
vector's width. Splitting the vector into its own child table removes that
coupling entirely: deleting from the (single, unchanged) `embeddings`
table cascades to whichever dimension table actually holds the
corresponding vector, without the caller ever naming a dimension.

### Schema

`embeddings` (existing table, altered — not dropped):

```sql
ALTER TABLE "embeddings" DROP COLUMN "embedding";
```

Everything else on it — `id`, `knowledge_base_id`, `document_id`,
`chunk_id`, `chunk_text`, `chunk_position`, `model`, `created_at`,
`updated_at`, both FKs, both indexes — is untouched.

One new table per distinct `dimensions` value in the registry:

```sql
CREATE TABLE "embedding_vectors_{dimension}" (
  "embedding_id" uuid NOT NULL,
  "embedding" vector({dimension}) NOT NULL,
  CONSTRAINT "PK_embedding_vectors_{dimension}_id" PRIMARY KEY ("embedding_id"),
  CONSTRAINT "FK_embedding_vectors_{dimension}_embedding_id" FOREIGN KEY ("embedding_id")
    REFERENCES "embeddings" ("id") ON DELETE CASCADE
);
CREATE INDEX "IDX_embedding_vectors_{dimension}_hnsw" ON "embedding_vectors_{dimension}"
  USING hnsw ("embedding" vector_cosine_ops);
```

Two columns, one FK, one index — that's the entire cost of supporting a
new dimension.

### TypeORM entities

`EmbeddingTypeOrmEntity` maps to the (unchanged) `embeddings` table and
loses its `embedding` column entirely — pure metadata now. A separate
factory generates one minimal vector-only entity class per dimension:

```ts
// infrastructure/persistence/typeorm/entities/embedding-vector-entity.factory.ts
export abstract class EmbeddingVectorTypeOrmEntity {
  @PrimaryColumn({ name: 'embedding_id', type: 'uuid' })
  embeddingId!: string;
}

export function createEmbeddingVectorTypeOrmEntity(
  dimensions: number,
): Type<EmbeddingVectorTypeOrmEntity> {
  @Entity(`embedding_vectors_${dimensions}`)
  class EmbeddingVectorEntityForDimension extends EmbeddingVectorTypeOrmEntity {
    @Column({ type: 'vector', length: dimensions })
    embedding!: number[];
  }
  return EmbeddingVectorEntityForDimension;
}

export const EMBEDDING_DIMENSIONS = [
  ...new Set(EMBEDDING_MODELS_REGISTRY.map((m) => m.dimensions)),
];
export const EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION = new Map(
  EMBEDDING_DIMENSIONS.map((d) => [d, createEmbeddingVectorTypeOrmEntity(d)]),
);
```

All generated classes plus the unchanged `EmbeddingTypeOrmEntity` are
registered in `TypeOrmModule.forFeature([...])`.

### Repositories

```ts
export interface IEmbeddingWriteRepository {
  // Insert needs the dimension to know which vector table to write to.
  saveMany(embeddings: EmbeddingAggregate[], dimensions: number): Promise<void>;
  // Deletes never need a dimension — they delete from `embeddings`
  // (metadata) and rely on ON DELETE CASCADE to remove the matching
  // vector row from whichever dimension table it's actually in.
  deleteByDocumentId(documentId: string): Promise<void>;
  deleteByKnowledgeBaseId(knowledgeBaseId: string): Promise<void>;
  // Used by the re-embed pipeline: clear a specific model's rows for a
  // Knowledge Base without touching rows just written under a different
  // (target) model for the same tenant. See "Re-embedding pipeline" below.
  deleteByKnowledgeBaseIdAndModel(knowledgeBaseId: string, model: string): Promise<void>;
}

export interface IEmbeddingReadRepository {
  // Search still needs the dimension — it determines which vector table
  // to JOIN against before the ORDER BY ... <=> ... even runs.
  search(vector: number[], topK: number, dimensions: number): Promise<IEmbeddingSearchResult[]>;
}
```

`saveMany` runs both inserts (`embeddings` metadata rows, then the
matching `embedding_vectors_{dimensions}` rows) inside one DB transaction.
No extra round trip is needed to correlate the two: `EmbeddingAggregate.id`
is already generated client-side before persistence (`UuidValueObject.generate()`
in `EmbedDocumentChunksProcessor`/`ReembedKnowledgeBaseProcessor`, same
pattern every other aggregate in this codebase already uses), so both rows
for a given embedding share a known id upfront.

`search()` becomes a hand-written join instead of a single-table scan:

```sql
SELECT e.chunk_id, e.document_id, e.chunk_text, e.chunk_position,
       1 - (v.embedding <=> :queryVector) AS score
FROM "embeddings" e
JOIN "embedding_vectors_{dimensions}" v ON v.embedding_id = e.id
WHERE e.knowledge_base_id = :knowledgeBaseId
ORDER BY v.embedding <=> :queryVector
LIMIT :topK
```

The HNSW index on `embedding_vectors_{dimensions}.embedding` still drives
the `ORDER BY` exactly as before — the join is on primary keys and adds no
meaningful cost.

## Resolving a Knowledge Base's current model

`embeddings` needs, for a given `knowledgeBaseId`: the current
`embeddingModel` (to pass to `IEmbeddingPort`) and its `dimensions` (to
route to the right table). This is a cross-context read into
`knowledge-bases`, which already owns a suitable query
(`KnowledgeBaseFindByIdQuery`, extended with the two new fields on
`KnowledgeBaseViewModel`).

New port in `embeddings/application/ports/knowledge-base-embedding-config.port.ts`:

```ts
export interface IKnowledgeBaseEmbeddingConfig {
  embeddingModel: string;
  embeddingStatus: 'READY' | 'REEMBEDDING' | 'FAILED';
}
export interface IKnowledgeBaseEmbeddingConfigPort {
  getByKnowledgeBaseId(knowledgeBaseId: string): Promise<IKnowledgeBaseEmbeddingConfig>;
}
```

Implemented in `embeddings/infrastructure/adapters/knowledge-base-embedding-config.adapter.ts`
by dispatching `KnowledgeBaseFindByIdQuery` through the global `QueryBus` —
the same established cross-context pattern as `EmbeddingSearchAdapter` in
`retrieval` and `DocumentChunkSourceAdapter` in `embeddings` itself. Every
write/search entry point (the embed pipeline processor, `EmbeddingSearchQuery`
handler) resolves this once at the start of the operation, then derives
`dimensions` from `EmbeddingModelRegistryService.getOrThrow(config.embeddingModel).dimensions`
and rejects (search) or proceeds (embed pipeline always runs regardless of
status — a document's own chunking/embedding is independent of *other*
documents' re-embed state) accordingly.

`EmbeddingSearchQueryHandler` MUST throw a domain exception (surfaced as
HTTP 409) if `embeddingStatus !== 'READY'`, before calling the provider or
touching any table — this is `retrieval`'s search-blocking requirement,
enforced at the source rather than duplicated in `retrieval`.

**Only the embed pipeline and search need this port.** Because deletes no
longer take a `dimensions` parameter (see "Repositories" above), the three
cleanup listeners (`DocumentChunkingStartedListener`, `DocumentDeletedListener`,
`KnowledgeBaseDeletedListener`) are **unchanged** by this proposal — they
call `deleteByDocumentId`/`deleteByKnowledgeBaseId` exactly as they do
today, with no new cross-context dependency on `knowledge-bases`' embedding
config at all.

## Knowledge Base changes

### New fields

```ts
// knowledge-bases/domain/value-objects/knowledge-base-embedding-model/knowledge-base-embedding-model.value-object.ts
export class KnowledgeBaseEmbeddingModelValueObject extends StringValueObject {
  constructor(value: string) { super(value, { allowEmpty: false, maxLength: 100 }); }
}

// knowledge-bases/domain/enums/knowledge-base-embedding-status.enum.ts
export enum KnowledgeBaseEmbeddingStatus { READY = 'READY', REEMBEDDING = 'REEMBEDDING', FAILED = 'FAILED' }

// knowledge-bases/domain/value-objects/knowledge-base-embedding-status/knowledge-base-embedding-status.value-object.ts
export class KnowledgeBaseEmbeddingStatusValueObject extends EnumValueObject<typeof KnowledgeBaseEmbeddingStatus> { ... }
```

`knowledge-bases` deliberately does **not** import `embeddings`' domain
types (`EmbeddingModelValueObject` etc.) — cross-context boundary rule: a
context may only reach another's domain/application from
`infrastructure/adapters/`. `knowledge-bases` owns its own
"what model string did the caller pick" value object; whether that string
is a *valid, known* model is checked via the port below, not by sharing a
type.

`knowledge_bases` table gains:

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `embedding_model` | varchar(100) | No | none — required from creation on |
| `embedding_status` | varchar(20) | No | `'READY'` |

### Cross-context model validation

`knowledge-bases/application/ports/embedding-model-validation.port.ts`:

```ts
export interface IEmbeddingModelValidationPort {
  isValid(modelId: string): Promise<boolean>;
}
```

Implemented in `knowledge-bases/infrastructure/adapters/embedding-model-validation.adapter.ts`,
dispatching the new public `EmbeddingAvailableModelsQuery` (or a dedicated
internal `EmbeddingModelExistsQuery` — internal is preferred, avoids a
network-shaped round trip through a "list everything" query just to check
one id) via `QueryBus`. `CreateKnowledgeBaseCommandHandler` and
`ChangeKnowledgeBaseEmbeddingModelCommandHandler` both call this before
touching the aggregate; an unknown model raises `InvalidEmbeddingModelException`
(400).

### ChangeKnowledgeBaseEmbeddingModel (new public command)

```
PATCH /knowledge-bases/:id/embedding-model   { embeddingModel: string }
changeKnowledgeBaseEmbeddingModel(id, embeddingModel): KnowledgeBase   (GraphQL mutation)
```

Handler:
1. `assertExists`.
2. Validate `embeddingModel` via `IEmbeddingModelValidationPort`.
3. If `embeddingModel` equals the current value → no-op, return early (idempotent, no event).
4. If `embeddingStatus === REEMBEDDING` already → reject
   (`KnowledgeBaseReembeddingInProgressException`, 409) — no concurrent
   re-embed runs.
5. `knowledgeBase.changeEmbeddingModel(newModel)` — aggregate method sets
   `_embeddingModel = newModel`, `_embeddingStatus = REEMBEDDING`, applies
   `KnowledgeBaseEmbeddingModelChangeRequestedEvent { knowledgeBaseId, previousModel, newModel }`.
6. Save + publish.

The model pointer flips immediately (not after re-embedding completes) —
consistent with the blocking design: nothing reads `embeddingModel` for
search purposes while `embeddingStatus !== READY`, so there is no window
where a stale pointer could route a search incorrectly.

### Two new internal-only commands (no transport)

- `CompleteKnowledgeBaseReembeddingCommand { knowledgeBaseId }` — sets
  `embeddingStatus = READY`. Dispatched by `embeddings`' re-embed processor
  on success.
- `FailKnowledgeBaseReembeddingCommand { knowledgeBaseId, reason }` — sets
  `embeddingStatus = FAILED`. Dispatched on re-embed failure. A
  `FAILED` Knowledge Base can retry by calling
  `ChangeKnowledgeBaseEmbeddingModel` again (with the same or a different
  model) — re-embedding is idempotent from `documents`' perspective (it
  re-reads current chunks, doesn't depend on prior partial state).

## Re-embedding pipeline

```
ChangeKnowledgeBaseEmbeddingModelCommand
     │ (knowledge-bases)
     ▼
KnowledgeBaseEmbeddingModelChangeRequestedEvent { knowledgeBaseId, previousModel, newModel }
     │
     ▼
KnowledgeBaseEmbeddingModelChangedListener (embeddings/infrastructure/adapters/)
     └─> IEmbeddingReembedQueuePort.enqueueReembed(knowledgeBaseId, previousModel, newModel)
              │
              ▼
       BullMQ "embeddings" queue (existing queue, new job type)
              │
              ▼
ReembedKnowledgeBaseProcessor.process(job)
     │
knowledgeBaseContext.run(knowledgeBaseId, async () => {
     ├─ EmbeddingWriteRepo.deleteByKnowledgeBaseIdAndModel(knowledgeBaseId, newModel)
     │     # clears any partial rows from a previously failed attempt at
     │     # this same target model — makes every attempt a clean rewrite,
     │     # regardless of how a prior one failed (see proposal.md's
     │     # "Partial re-embed retry" Open Question)
     ├─ documentIds = ChunkSourcePort.findKnowledgeBaseDocumentIds(knowledgeBaseId)  # new
     ├─ for each documentId (sequential batches, same batching the initial
     │     pipeline already uses per document — no new concurrency model):
     │     ├─ chunks = ChunkSourcePort.findByDocumentId(documentId)
     │     ├─ vectors = EmbeddingPort.embedBatch(chunks.map(c => c.text), newModel)
     │     └─ EmbeddingWriteRepo.saveMany(built EmbeddingAggregate[], newDimensions)
     ├─ EmbeddingWriteRepo.deleteByKnowledgeBaseIdAndModel(knowledgeBaseId, previousModel)
     └─ dispatch CompleteKnowledgeBaseReembeddingCommand (or Fail... on any error)
})
```

`ChunkSourcePort` gains `findKnowledgeBaseDocumentIds(knowledgeBaseId): Promise<string[]>`,
backed by a new internal-only query in `documents`
(`DocumentFindIdsByKnowledgeBaseIdQuery`) — the existing port only supports
per-document lookup (`findByDocumentId`), which was sufficient when only
one document's chunks were ever embedded at a time.

`deleteByKnowledgeBaseIdAndModel` filters by `model` (a plain column on the
unchanged `embeddings` table), not by dimension — the new rows being
written under `newModel` and the old rows still under `previousModel`
coexist in the *same* `embeddings` table (and possibly, if both models
happen to share a dimension, the same vector table too) for the duration
of the job, disambiguated purely by the `model` value on each row. This is
what makes it safe to write the new model's rows before deleting the old
model's rows, rather than having to delete-then-insert with a window of
zero embeddings.

Deleting the old model's rows only after every document has been
successfully re-embedded (not incrementally per document) avoids a partial
state where some documents are searchable under the new model and others
have no embeddings at all if the job fails partway — better to fail with
"still on old model, marked FAILED" than to strand a subset of documents
with zero embeddings during a status window that's supposed to mean "not
searchable, but doing so safely."

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|----------|--------|------------------------|-----------|
| Dimension discovery | Static code registry | Live probe call to the provider on registration | Zero added provider cost/latency/failure-mode for the MVP; the registry covers the models this service ships support for. Live probing deferred (see Open Questions) |
| Table strategy | Normalized: unchanged `embeddings` metadata table + one `embedding_vectors_{dimension}` table per distinct dimension, linked 1:1 by `ON DELETE CASCADE` | Duplicate the full row shape per dimension (one fat table per dimension); one table per model instead of per dimension; a single JSON/array column with app-side cosine similarity; a single table padded to the max dimension | pgvector requires fixed column width, so *some* per-dimension split is unavoidable, but splitting only the vector column keeps every non-vector index/FK/delete path defined exactly once instead of duplicated per dimension, and makes deletes dimension-agnostic via cascade; per-model tables would be redundant when models share a width; app-side similarity doesn't scale and defeats the point of an ANN index; padding to max width wastes storage/index quality for every smaller-dimension model and still needs per-width indexes to be useful |
| Model change behavior | Blocking: `REEMBEDDING` status rejects search until the background job completes | Zero-downtime dual-serving with atomic cutover | Simpler state machine (no "pending model" alongside "current model"); acceptable UX per product decision — a Knowledge Base's own operator triggers this deliberately and can expect a transitional window; non-blocking variant recorded as explicit future work |
| Model scope | Per Knowledge Base, stored as a KB field | Global env var (status quo) | Product requirement: different Knowledge Bases must be able to use different models, and a single Knowledge Base must be able to change models without breaking |
| Cross-context model resolution | `embeddings` reads `knowledge-bases`' view model via `QueryBus` (extended `KnowledgeBaseFindByIdQuery`) | Duplicate `embeddingModel` into every `EmbeddingSearchQuery`/pipeline call from the caller | Avoids trusting/re-validating a caller-supplied model on every call; single read at the point where a dimension actually needs resolving keeps the source of truth in one place (`knowledge-bases`) |
| `IEmbeddingPort` signature | `embed(text, model)` / `embedBatch(texts, model)` — model explicit per call | Keep implicit config-driven model, add a second "override" method | Every caller now resolves a per-KB model before calling anyway (to also resolve the table dimension) — an implicit fallback would just be dead code paths no caller uses |

## Data Flow (updated)

```
Embedding (async, triggered by documents' pipeline — unchanged trigger, changed body):
DocumentChunkedEvent
     │
DocumentChunkedListener ──> EmbeddingProcessingQueuePort.enqueueEmbedding(documentId, knowledgeBaseId)
     ▼
EmbedDocumentChunksProcessor.process(job)
knowledgeBaseContext.run(job.data.knowledgeBaseId, async () => {
     ├─ config = KnowledgeBaseEmbeddingConfigPort.getByKnowledgeBaseId(knowledgeBaseId)
     ├─ { dimensions } = EmbeddingModelRegistryService.getOrThrow(config.embeddingModel)
     ├─ chunks = ChunkSourcePort.findByDocumentId(documentId)
     ├─ vectors = EmbeddingPort.embedBatch(chunks.map(c => c.text), config.embeddingModel)
     └─ EmbeddingWriteRepo.saveMany(built EmbeddingAggregate[], dimensions)
})

Model change (new):
ChangeKnowledgeBaseEmbeddingModelCommand ──> KnowledgeBaseEmbeddingModelChangeRequestedEvent
     ──> enqueue reembed job ──> ReembedKnowledgeBaseProcessor (see pipeline above)
     ──> CompleteKnowledgeBaseReembeddingCommand | FailKnowledgeBaseReembeddingCommand

Search (sync, public — unchanged trigger, changed body):
RetrievalSearchQuery ──> EmbeddingSearchAdapter ──(QueryBus)──> EmbeddingSearchQuery (embeddings)
     ├─ config = KnowledgeBaseEmbeddingConfigPort.getByKnowledgeBaseId(knowledgeBaseId)
     ├─ if config.embeddingStatus !== READY: throw KnowledgeBaseNotReadyForSearchException (409)
     ├─ { dimensions } = EmbeddingModelRegistryService.getOrThrow(config.embeddingModel)
     ├─ vector = EmbeddingPort.embed(query.text, config.embeddingModel)
     └─ EmbeddingReadRepo.search(vector, topK, dimensions)
```

## Database Schema

### `knowledge_bases` (altered)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `embedding_model` | varchar(100) | No | New. No default — required at creation |
| `embedding_status` | varchar(20) | No | New. Default `'READY'` |

### `embeddings` (altered — vector column removed)

Same table, same rows, same FKs/indexes as today, minus the `embedding`
column. See proposal.md's Impact table for the pre-existing column list.

### `embedding_vectors_{dimension}` (new — replaces the old `embedding` column)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `embedding_id` | UUID | No | PK; FK to `embeddings.id`, `ON DELETE CASCADE` |
| `embedding` | vector({dimension}) | No | |

Initial migration creates one per distinct dimension in
`EMBEDDING_MODELS_REGISTRY` at the time this change ships:
`embedding_vectors_768`, `embedding_vectors_1024`, `embedding_vectors_1536`,
`embedding_vectors_3072`. Each has its own HNSW cosine index.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `EmbeddingModelRegistryService` (found/unknown), write repository (transactional saveMany writes both tables with matching ids; delete methods never require a dimension), read repository (resolves the correct vector table per dimension for the join — mocked repo map), `ChangeKnowledgeBaseEmbeddingModel` handler (no-op on same model, rejects mid-reembed, emits event), `EmbeddingSearchQueryHandler` (rejects when status !== READY), `ReembedKnowledgeBaseProcessor` (happy path across multiple documents, failure path dispatches Fail command, deletes previous model's rows only after all documents succeed, clears target model's rows before starting) | Jest, `jest.Mocked<T>` |
| Integration | Insert embeddings under two different dimensions in the same test run; assert deleting by `document_id`/`knowledge_base_id` from `embeddings` cascades correctly into whichever `embedding_vectors_{dimension}` table held the vector, with no dimension passed by the caller; assert search's join only ever touches the table matching the resolved dimension; `knowledge_bases` migration round-trip (`up`/`down`) | Real Postgres (pgvector image) |
| E2E | `POST /knowledge-bases` requires `embeddingModel`, rejects unknown model; `PATCH .../embedding-model` flips status to `REEMBEDDING`, search returns 409 meanwhile, then flips back to `READY` after the (test-stubbed) embedding port completes and results reflect the new model's table | supertest, embedding port stubbed at the HTTP boundary |

## Migration / Rollout

Three migrations, in order:

1. **Alter `knowledge_bases`**: add `embedding_model` (backfill existing
   rows, if any, with `'text-embedding-3-small'` — the previous implicit
   global default — before making it `NOT NULL`), add `embedding_status`
   default `'READY'`.
2. **Alter `embeddings`**: `DROP COLUMN "embedding"` (and its HNSW index).
   No production data to preserve (explicit product decision) for the
   vector values themselves — `down()` re-adds a `vector(1536)` column
   (the previous fixed dimension) and its HNSW index, matching the current
   `CreateEmbeddings1780000000003` shape. Every other column, both FKs, and
   both existing indexes on `embeddings` are untouched by this migration.
3. **Create `embedding_vectors_{dimension}` tables**: one per distinct
   dimension in the initial registry, each with its FK to `embeddings.id`
   (`ON DELETE CASCADE`) and its own HNSW index; `down()` drops all of
   them.

`.env.example`: remove `EMBEDDINGS_MODEL` (no longer meaningful — model is
per-Knowledge-Base now); `EMBEDDINGS_BASE_URL`/`EMBEDDINGS_API_KEY` remain
(the HTTP endpoint/credentials are still deployment-wide, only the `model`
field in each request body varies).
