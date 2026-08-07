# Spec Delta: `embeddings` — change `flexible-embedding-dimensions`

## 1. Domain Model

### 1.1 EmbeddingModelDefinition (new, static)

`EMBEDDING_MODELS_REGISTRY: readonly EmbeddingModelDefinition[]` — code
constant, not persisted. `{ id: string; provider: string; dimensions: number }`.
Initial entries: `text-embedding-3-small` (1536, openai),
`text-embedding-3-large` (3072, openai), `text-embedding-ada-002` (1536,
openai), `nomic-embed-text` (768, ollama), `mxbai-embed-large` (1024,
ollama).

`EMBEDDING_VECTOR_DIMENSIONS` (old single global constant) is REMOVED.

### 1.2 EmbeddingModelRegistryService (new, domain, no I/O)

```ts
findById(modelId: string): EmbeddingModelDefinition | null
getOrThrow(modelId: string): EmbeddingModelDefinition  // throws UnknownEmbeddingModelException
listAll(): readonly EmbeddingModelDefinition[]
```

### 1.3 EmbeddingAggregate (unchanged shape)

Same fields as before (`id`, `knowledgeBaseId`, `documentId`, `chunkId`,
`chunkText`, `chunkPosition`, `embedding`, `model`, `createdAt`). The
`embedding` value object's length is no longer fixed at construction time
via a shared constant — callers MUST know and pass the correct dimension
for the Knowledge Base's current model (enforced by the routing repository,
not the aggregate itself).

## 2. Public Queries (new transport surface)

This context previously had none. It now exposes exactly one, non-tenant,
non-guarded:

### 2.1 EmbeddingAvailableModels (public)

**Path:** `GET /embeddings/models` · GraphQL `embeddingModels`.

**Rules:** No input. Returns `EMBEDDING_MODELS_REGISTRY` verbatim
(`{ id, provider, dimensions }[]`). No guard — static, non-sensitive
configuration data, not tenant-scoped.

### 2.2 EmbeddingModelExists (internal only, no transport)

**Inputs:** `modelId: string`. Returns `boolean`. Dispatched by
`knowledge-bases`' `IEmbeddingModelValidationPort` adapter via `QueryBus`.

## 3. Cross-context: Knowledge Base embedding config

### 3.1 IKnowledgeBaseEmbeddingConfigPort

```ts
export interface IKnowledgeBaseEmbeddingConfig {
  embeddingModel: string;
  embeddingStatus: 'READY' | 'REEMBEDDING' | 'FAILED';
}
export interface IKnowledgeBaseEmbeddingConfigPort {
  getByKnowledgeBaseId(knowledgeBaseId: string): Promise<IKnowledgeBaseEmbeddingConfig>;
}
```

Implemented in `infrastructure/adapters/knowledge-base-embedding-config.adapter.ts`,
dispatching `knowledge-bases`' `KnowledgeBaseFindByIdQuery` (extended with
`embeddingModel`/`embeddingStatus`) via `QueryBus`.

Only the embed pipeline and search resolve this port — deletes do not (see
§4.2).

## 4. Persistence — normalized metadata + per-dimension vector tables

### 4.1 Schema

`embeddings` (existing table) is ALTERed, not replaced: its `embedding`
column is dropped, everything else (`knowledge_base_id`, `document_id`,
`chunk_id`, `chunk_text`, `chunk_position`, `model`, timestamps, both FKs,
both non-vector indexes) is untouched.

A new table per distinct `dimensions` value in the registry holds only the
vector: `embedding_vectors_768`, `embedding_vectors_1024`,
`embedding_vectors_1536`, `embedding_vectors_3072` (initial set). Each has
exactly `embedding_id` (PK, FK to `embeddings.id`, `ON DELETE CASCADE`) and
`embedding vector({dimension})`, plus its own HNSW cosine index.

### 4.2 Repository interfaces (modified)

```ts
export interface IEmbeddingWriteRepository {
  saveMany(embeddings: EmbeddingAggregate[], dimensions: number): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
  deleteByKnowledgeBaseId(knowledgeBaseId: string): Promise<void>;
  deleteByKnowledgeBaseIdAndModel(knowledgeBaseId: string, model: string): Promise<void>;
}

export interface IEmbeddingReadRepository {
  search(vector: number[], topK: number, dimensions: number): Promise<IEmbeddingSearchResult[]>;
}
```

**`saveMany` MUST** write both the `embeddings` metadata rows and the
matching `embedding_vectors_{dimensions}` rows inside one DB transaction,
using each `EmbeddingAggregate`'s already-generated id to correlate them
(no round trip needed).

**`deleteByDocumentId`/`deleteByKnowledgeBaseId` MUST NOT** take a
dimension — they delete from `embeddings` only, relying on
`ON DELETE CASCADE` to remove the corresponding row from whichever
`embedding_vectors_{dimension}` table actually holds it. This is why the
three cleanup listeners (document deleted, document re-chunking, Knowledge
Base deleted) need no cross-context knowledge of the Knowledge Base's
current model at all.

**`deleteByKnowledgeBaseIdAndModel` MUST** filter by the `model` column on
`embeddings` (not by dimension) — used only by the re-embed pipeline (§5.2)
to target one specific model's rows for a Knowledge Base while leaving
another model's rows for the same tenant (new or old) untouched, even when
both models happen to share a dimension and therefore a vector table.

**`search` MUST** resolve `dimensions` to pick which
`embedding_vectors_{dimension}` table to `JOIN` against; an unregistered
dimension (should be unreachable if the registry and the migrated tables
are kept in sync) throws `NoEmbeddingTableForDimensionException`.

## 5. Embedding pipeline (modified)

### 5.1 EmbedDocumentChunks (internal, modified)

Processor MUST, before embedding:
1. Resolve `IKnowledgeBaseEmbeddingConfigPort.getByKnowledgeBaseId(knowledgeBaseId)`.
2. Resolve `dimensions` from the registry for `config.embeddingModel`.
3. Call `IEmbeddingPort.embedBatch(texts, config.embeddingModel)` — model
   explicit, no longer implicit from a global config.
4. `saveMany(..., dimensions)`.

This step runs regardless of the Knowledge Base's `embeddingStatus` — a
document's normal chunk→embed flow is independent of another,
possibly-concurrent, model-change re-embed for the same Knowledge Base;
see Scenario SC-07 for the one exception this creates.

### 5.2 ReembedKnowledgeBase (new, internal, no transport)

Triggered by `KnowledgeBaseEmbeddingModelChangedListener`
(`@EventsHandler(KnowledgeBaseEmbeddingModelChangeRequestedEvent)` from
`@contexts/knowledge-bases/`), which enqueues a job via
`IEmbeddingReembedQueuePort.enqueueReembed(knowledgeBaseId, previousModel, newModel)`
onto the existing `embeddings` BullMQ queue.

`ReembedKnowledgeBaseProcessor` MUST, inside its own
`KnowledgeBaseContext.run(knowledgeBaseId, ...)` frame:
1. `deleteByKnowledgeBaseIdAndModel(knowledgeBaseId, newModel)` — clears
   any partial rows from a previously failed attempt at this same target
   model, so every attempt is a clean rewrite.
2. Enumerate every document id for the Knowledge Base via
   `IChunkSourcePort.findKnowledgeBaseDocumentIds(knowledgeBaseId)` (new
   port method, backed by a new internal `documents` query).
3. For each document: fetch its chunks, embed them with `newModel`, save
   into the new dimension's table (rows tagged `model = newModel`).
4. Only after every document succeeds:
   `deleteByKnowledgeBaseIdAndModel(knowledgeBaseId, previousModel)` —
   removes only the old model's rows; the just-written new-model rows are
   untouched even if both models share a dimension/table.
5. On full success: dispatch `CompleteKnowledgeBaseReembeddingCommand`.
6. On any failure: dispatch `FailKnowledgeBaseReembeddingCommand` with the
   error reason. MUST NOT delete the previous model's data in this path —
   the Knowledge Base stays recoverable (though search itself stays
   blocked while `FAILED`, per `knowledge-bases`' spec — this only affects
   the safety of the retry path).

### 5.3 IEmbeddingPort (modified signature)

```ts
export interface IEmbeddingPort {
  embed(text: string, model: string): Promise<number[]>;
  embedBatch(texts: string[], model: string): Promise<number[][]>;
}
```

`OpenAiCompatibleEmbeddingService` sends the given `model` in the request
body instead of a config-injected constant. `EmbeddingsConfig` drops
`embeddingModel`; `EMBEDDINGS_MODEL` env var is removed.

## 6. Search (modified)

### 6.1 EmbeddingSearch (internal, dispatched by `retrieval`)

MUST, before embedding the query text:
1. Resolve `IKnowledgeBaseEmbeddingConfigPort.getByKnowledgeBaseId(knowledgeBaseId)`.
2. If `config.embeddingStatus !== 'READY'`: throw
   `KnowledgeBaseNotReadyForSearchException` (surfaced by `retrieval` as
   HTTP 409).
3. Otherwise resolve `dimensions`, call
   `IEmbeddingPort.embed(query.text, config.embeddingModel)`, then
   `IEmbeddingReadRepository.search(vector, topK, dimensions)`.

## 7. Cross-context (new/modified adapters)

| Port | Direction | Backed by |
|------|-----------|-----------|
| `IKnowledgeBaseEmbeddingConfigPort` | `embeddings` → `knowledge-bases` | `KnowledgeBaseFindByIdQuery` (extended) via `QueryBus` |
| `IChunkSourcePort.findKnowledgeBaseDocumentIds` | `embeddings` → `documents` | New internal `DocumentFindIdsByKnowledgeBaseIdQuery` via `QueryBus` |
| `IEmbeddingModelValidationPort` (consumer-side, defined in `knowledge-bases`) | `knowledge-bases` → `embeddings` | New internal `EmbeddingModelExistsQuery` via `QueryBus` |

## 8. Scenarios

### SC-01 List available models
**Given** the static registry has 5 entries
**When** `GET /embeddings/models`
**Then** HTTP 200, all 5 returned with `id`/`provider`/`dimensions`, no
guard/auth required.

### SC-02 Embed pipeline uses the Knowledge Base's own model
**Given** KB1 configured with `nomic-embed-text` (768) and KB2 with
`text-embedding-3-small` (1536)
**When** each ingests a document and the embed pipeline runs
**Then** KB1's metadata rows in `embeddings` have `model = 'nomic-embed-text'`
with their vectors in `embedding_vectors_768`; KB2's have
`model = 'text-embedding-3-small'` with their vectors in
`embedding_vectors_1536`.

### SC-03 Search blocked during re-embedding
**Given** a Knowledge Base with `embeddingStatus = REEMBEDDING`
**When** a search is attempted for that Knowledge Base
**Then** HTTP 409, no provider call made, no table read.

### SC-04 Re-embed moves all documents to the new model
**Given** a Knowledge Base with 3 documents embedded under
`text-embedding-3-small` (1536), then changed to `nomic-embed-text` (768)
**When** the re-embed job completes
**Then** `embeddings` has one metadata row per chunk across all 3 documents
with `model = 'nomic-embed-text'` (their vectors in
`embedding_vectors_768`), and zero rows with
`model = 'text-embedding-3-small'` remain for that Knowledge Base.

### SC-05 Re-embed failure leaves the old model's data intact
**Given** a re-embed job that fails partway (e.g. provider error on
document 2 of 3)
**When** the failure is handled
**Then** `FailKnowledgeBaseReembeddingCommand` is dispatched, every row
with `model = 'text-embedding-3-small'` (the previous model) for that
Knowledge Base is untouched, and only whatever partial rows were written
under `model = 'nomic-embed-text'` before the failure remain (see
proposal.md's Open Questions — "Partial re-embed retry" — for the
clear-before-retry behavior that makes the next attempt safe).

### SC-06 Two Knowledge Bases with the same dimension share a vector table safely
**Given** KB1 on `text-embedding-3-small` and KB2 on `text-embedding-ada-002`
(both 1536, so both land in `embedding_vectors_1536`)
**When** both are searched
**Then** each only ever sees its own `knowledge_base_id`'s rows via the
`embeddings` join — the existing tenant-scoping guarantee, unaffected by
two models sharing a vector table.

### SC-07 Normal ingestion during a concurrent re-embed
**Given** a Knowledge Base in `REEMBEDDING` (model change in progress) that
also receives a brand-new document via the normal ingestion pipeline
**When** the new document finishes chunking and its embed job runs
**Then** it embeds under the Knowledge Base's *current* `embeddingModel`
(the new one, already flipped at request time) — no special-casing needed,
but note this document's chunks will NOT be picked up by the in-flight
re-embed job if it already passed the document-enumeration step (§5.2.1);
flagged as a known race in proposal.md's Open Questions ("New document
during re-embed"), acceptable for this change since it can only
under-embed (never search a wrong-dimension vector), and a second
`ChangeKnowledgeBaseEmbeddingModel` call is always a safe retry.
