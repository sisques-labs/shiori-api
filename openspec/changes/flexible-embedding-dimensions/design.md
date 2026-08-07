# Design: Flexible embedding vector dimensions per Knowledge Base

## Technical Approach

Three pieces, in order of how they compose:

1. **A static model registry** in `embeddings` — the single source of truth
   mapping a model id to its provider and dimension. Nothing ever computes
   a dimension at runtime; it's looked up.
2. **A physical table per distinct dimension** in `embeddings` — pgvector's
   fixed-width `vector(N)` column means one dimension per table is the only
   option that keeps ANN indexing (HNSW) usable. A routing layer picks the
   right table based on the dimension resolved for the Knowledge Base doing
   the read/write.
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
a registry entry and a migration creating `embeddings_{dimension}` (see
"Table-per-dimension" below); this is documented as the standard "add a new
embedding model" runbook in `embeddings/README.md`, not hidden.

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

## Table-per-dimension

### Why per-dimension, not per-model

Two models that happen to share a dimension (e.g. `text-embedding-3-small`
and `text-embedding-ada-002`, both 1536) can share a physical table — the
only thing pgvector cares about is column width. The existing `model`
varchar column on each row already disambiguates which model actually
produced a given vector (carried over unchanged from the current schema).
Keying tables by model instead of dimension would create redundant
identical-shape tables for no benefit.

### Schema

For every distinct `dimensions` value in the registry, one table:

```sql
CREATE TABLE "embeddings_{dimension}" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "knowledge_base_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "chunk_id" uuid NOT NULL,
  "chunk_text" text NOT NULL,
  "chunk_position" integer NOT NULL,
  "embedding" vector({dimension}) NOT NULL,
  "model" character varying(100) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_embeddings_{dimension}_id" PRIMARY KEY ("id"),
  CONSTRAINT "FK_embeddings_{dimension}_document_id" FOREIGN KEY ("document_id")
    REFERENCES "documents" ("id") ON DELETE CASCADE,
  CONSTRAINT "FK_embeddings_{dimension}_chunk_id" FOREIGN KEY ("chunk_id")
    REFERENCES "chunks" ("id") ON DELETE CASCADE
);
CREATE INDEX "IDX_embeddings_{dimension}_knowledge_base_id" ON "embeddings_{dimension}" ("knowledge_base_id");
CREATE INDEX "IDX_embeddings_{dimension}_document_id" ON "embeddings_{dimension}" ("document_id");
CREATE INDEX "IDX_embeddings_{dimension}_embedding_hnsw" ON "embeddings_{dimension}"
  USING hnsw ("embedding" vector_cosine_ops);
```

Identical shape to the current `embeddings` table, just parameterized by
dimension and table name.

### TypeORM entity-per-dimension

TypeORM's `@Entity`/`@Column` decorators are static — there is no way to
parameterize a single class's table name or column width at runtime. A
factory function generates one distinct class per dimension in the
registry:

```ts
// infrastructure/persistence/typeorm/entities/embedding-entity.factory.ts
export function createEmbeddingTypeOrmEntity(dimensions: number): Type<EmbeddingTypeOrmEntity> {
  @Entity(`embeddings_${dimensions}`)
  @Index(`IDX_embeddings_${dimensions}_knowledge_base_id`, ['knowledgeBaseId'])
  @Index(`IDX_embeddings_${dimensions}_document_id`, ['documentId'])
  class EmbeddingEntityForDimension extends EmbeddingTypeOrmEntity {
    @Column({ type: 'vector', length: dimensions })
    embedding!: number[];
  }
  return EmbeddingEntityForDimension;
}
```

`EmbeddingTypeOrmEntity` becomes an abstract base (`id`, `knowledgeBaseId`,
`documentId`, `chunkId`, `chunkText`, `chunkPosition`, `model`,
`createdAt`, `updatedAt` — everything except `embedding`, whose type
depends on dimension). A module-level constant builds one concrete class
per unique dimension in `EMBEDDING_MODELS_REGISTRY` and registers all of
them in `TypeOrmModule.forFeature([...])`:

```ts
export const EMBEDDING_DIMENSIONS = [
  ...new Set(EMBEDDING_MODELS_REGISTRY.map((m) => m.dimensions)),
];
export const EMBEDDING_ENTITIES_BY_DIMENSION = new Map(
  EMBEDDING_DIMENSIONS.map((d) => [d, createEmbeddingTypeOrmEntity(d)]),
);
```

### Routing repositories

The read/write repository interfaces stay the same shape as today
(`IEmbeddingReadRepository.search`, `IEmbeddingWriteRepository.saveMany` /
`deleteByDocumentId` / `deleteByKnowledgeBaseId`), but the TypeORM
implementations become **routing** repositories: instead of one injected
`Repository<EmbeddingTypeOrmEntity>`, they hold a
`Map<number, Repository<EmbeddingTypeOrmEntity>>` (one per dimension,
built from `EMBEDDING_ENTITIES_BY_DIMENSION` at construction) and resolve
which one to use per call from the **caller-supplied dimension** — every
method gains a `dimensions: number` parameter (or the repository is
constructed per-call already scoped, see "Resolving a Knowledge Base's
current model" below for who supplies it). This mirrors the existing
tenant-scoping pattern (`createTenantRepository` wraps a raw repository
with an ambient `KnowledgeBaseContext`) but adds a second axis (dimension)
that cannot be ambient the same way, because unlike the tenant id it
determines *which table*, not just a `WHERE` clause.

```ts
export interface IEmbeddingWriteRepository {
  saveMany(embeddings: EmbeddingAggregate[], dimensions: number): Promise<void>;
  deleteByDocumentId(documentId: string, dimensions: number): Promise<void>;
  deleteByKnowledgeBaseId(knowledgeBaseId: string, dimensions: number): Promise<void>;
}

export interface IEmbeddingReadRepository {
  search(vector: number[], topK: number, dimensions: number): Promise<IEmbeddingSearchResult[]>;
}
```

Every call site already sits inside a flow that knows (or can resolve) the
Knowledge Base's current `embeddingModel` — see next section — so this is
a mechanical, not semantic, change to each caller.

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
     ├─ documentIds = ChunkSourcePort.findKnowledgeBaseDocumentIds(knowledgeBaseId)  # new
     ├─ for each documentId (sequential batches, same batching the initial
     │     pipeline already uses per document — no new concurrency model):
     │     ├─ chunks = ChunkSourcePort.findByDocumentId(documentId)
     │     ├─ vectors = EmbeddingPort.embedBatch(chunks.map(c => c.text), newModel)
     │     └─ EmbeddingWriteRepo.saveMany(built EmbeddingAggregate[], newDimensions)
     ├─ EmbeddingWriteRepo.deleteByKnowledgeBaseId(knowledgeBaseId, previousDimensions)
     └─ dispatch CompleteKnowledgeBaseReembeddingCommand (or Fail... on any error)
})
```

`ChunkSourcePort` gains `findKnowledgeBaseDocumentIds(knowledgeBaseId): Promise<string[]>`,
backed by a new internal-only query in `documents`
(`DocumentFindIdsByKnowledgeBaseIdQuery`) — the existing port only supports
per-document lookup (`findByDocumentId`), which was sufficient when only
one document's chunks were ever embedded at a time.

Deleting the old dimension's rows only after every document has been
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
| Table strategy | One physical table per distinct **dimension** | One table per model; one JSON/array column with app-side cosine similarity; a single table padded to the max dimension | pgvector requires fixed column width, so per-dimension is the minimum table count that still allows HNSW indexing; per-model would create redundant identical tables when models share a width; app-side similarity doesn't scale and defeats the point of an ANN index; padding to max width wastes storage/index quality for every smaller-dimension model and still needs per-width indexes to be useful |
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

### `embeddings_{dimension}` (replaces `embeddings`)

Identical column set to the current `embeddings` table (see proposal.md's
Impact table / current migration), parameterized per dimension as shown
above. Initial migration creates one per distinct dimension in
`EMBEDDING_MODELS_REGISTRY` at the time this change ships:
`embeddings_768`, `embeddings_1024`, `embeddings_1536`, `embeddings_3072`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `EmbeddingModelRegistryService` (found/unknown), routing repositories (resolve correct table per dimension — mocked repo map), `ChangeKnowledgeBaseEmbeddingModel` handler (no-op on same model, rejects mid-reembed, emits event), `EmbeddingSearchQueryHandler` (rejects when status !== READY), `ReembedKnowledgeBaseProcessor` (happy path across multiple documents, failure path dispatches Fail command, deletes old table only after all documents succeed) | Jest, `jest.Mocked<T>` |
| Integration | Insert into two different `embeddings_{dimension}` tables in the same test run and assert search only ever touches the table matching the resolved dimension; `knowledge_bases` migration round-trip (`up`/`down`) | Real Postgres (pgvector image) |
| E2E | `POST /knowledge-bases` requires `embeddingModel`, rejects unknown model; `PATCH .../embedding-model` flips status to `REEMBEDDING`, search returns 409 meanwhile, then flips back to `READY` after the (test-stubbed) embedding port completes and results reflect the new model's table | supertest, embedding port stubbed at the HTTP boundary |

## Migration / Rollout

Three migrations, in order:

1. **Alter `knowledge_bases`**: add `embedding_model` (backfill existing
   rows, if any, with `'text-embedding-3-small'` — the previous implicit
   global default — before making it `NOT NULL`), add `embedding_status`
   default `'READY'`.
2. **Drop `embeddings`**: no production data to preserve (explicit product
   decision) — `down()` recreates the original table exactly as the
   current `CreateEmbeddings1780000000003` migration does.
3. **Create `embeddings_{dimension}` tables**: one per distinct dimension
   in the initial registry; `down()` drops all of them.

`.env.example`: remove `EMBEDDINGS_MODEL` (no longer meaningful — model is
per-Knowledge-Base now); `EMBEDDINGS_BASE_URL`/`EMBEDDINGS_API_KEY` remain
(the HTTP endpoint/credentials are still deployment-wide, only the `model`
field in each request body varies).
