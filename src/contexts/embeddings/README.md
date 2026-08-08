# `embeddings`

Turns `documents`' chunks into vectors and stores them for similarity
search. Split out from `retrieval` — this context owns everything that
touches an embedding: the model registry, generation, storage, and the
pgvector similarity search itself. `retrieval` owns only query
orchestration and transport, reaching this context through a single
cross-context capability.

The embedding **model** is a per-`knowledge-bases` setting, not a global
`.env` value — see "Model registry" and "Cross-context: Knowledge Base
embedding config" below.

## Aggregate

`EmbeddingAggregate` — hydration-only, mirrors `documents`' `ChunkAggregate`
(derived data, single producer, no domain events, no public CRUD).

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `knowledgeBaseId` | UUID | Tenant; injected by the tenant repo |
| `documentId` | UUID | |
| `chunkId` | UUID | |
| `chunkText` | string | Denormalized from the source chunk at embed time |
| `chunkPosition` | number | Denormalized from the source chunk |
| `embedding` | number[] | Width varies per row — see "Normalized storage" below; `EmbeddingVectorValueObject` takes its dimension per-instance, not from a global constant |
| `model` | string | The embedding model that produced this vector |
| `createdAt` | Date | No `updatedAt` — a re-embed deletes and re-creates |

## Model registry

`EMBEDDING_MODELS_REGISTRY` (`domain/constants/embedding-models-registry.constant.ts`)
is a static, code-defined list — the single source of truth for which
embedding models this deployment supports and what dimension each one
produces. Nothing ever probes a provider to discover a dimension.

| Model id | Provider | Dimensions |
|----------|----------|------------|
| `text-embedding-3-small` | openai | 1536 |
| `text-embedding-3-large` | openai | 3072 |
| `text-embedding-ada-002` | openai | 1536 |
| `nomic-embed-text` | ollama | 768 |
| `mxbai-embed-large` | ollama | 1024 |

`EmbeddingModelRegistryService` (`domain/services/`, plain domain service,
no I/O) exposes `findById`/`getOrThrow`/`listAll` over this array.
`getOrThrow` throws `UnknownEmbeddingModelException` for an unregistered
model id.

### Adding a new embedding model

- **Same dimension as an existing model**: add one line to
  `EMBEDDING_MODELS_REGISTRY`. No migration needed.
- **New dimension**: add the registry entry AND a migration creating
  `embedding_vectors_{dimension}` (two columns, one FK, one HNSW index —
  copy the shape of `CreateEmbeddingVectorTables1780000000006`), then add
  the same dimension to `embedding-vector-entity.factory.ts`'s derived
  `EMBEDDING_DIMENSIONS` list (automatic — it's derived from the registry
  itself, so this step is really "the migration exists before the app
  boots against it").

### Public "list available models" query

The one transport surface this context has: `GET /embeddings/models` (REST)
and `embeddingModels` (GraphQL) return `EMBEDDING_MODELS_REGISTRY` verbatim
(`id`, `provider`, `dimensions`). No guard — static, non-sensitive,
non-tenant-scoped configuration. Used by `knowledge-bases` callers
(`CreateKnowledgeBase`, `ChangeKnowledgeBaseEmbeddingModel`) to populate a
model picker, and internally (`EmbeddingModelExistsQuery`, internal-only) by
`knowledge-bases`' own server-side validation of a submitted model id.

## Normalized storage: metadata table + one vector table per dimension

pgvector requires a fixed `vector(N)` column width, so a single dimension
can't serve every model. Rather than duplicating the whole `embeddings` row
shape per dimension, only the vector itself moves out:

- `embeddings` (unchanged table, minus its old `embedding` column) keeps
  every other column — `knowledge_base_id`, `document_id`, `chunk_id`,
  `chunk_text`, `chunk_position`, `model`, timestamps, both FKs, both
  non-vector indexes — untouched. This is pure metadata now.
- `embedding_vectors_{dimension}` (one physical table per distinct
  dimension in the registry: `embedding_vectors_768`,
  `embedding_vectors_1024`, `embedding_vectors_1536`,
  `embedding_vectors_3072`) holds only `embedding_id` (PK, FK to
  `embeddings.id`, `ON DELETE CASCADE`) and `embedding vector(N)`, plus its
  own HNSW cosine index. Two models that share a dimension (e.g.
  `text-embedding-3-small`/`text-embedding-ada-002`, both 1536) share a
  vector table, disambiguated by `embeddings.model`.

`EmbeddingVectorTypeOrmEntity` (abstract base, `embeddingId` only) +
`createEmbeddingVectorTypeOrmEntity(dimensions)` (factory, one generated
`@Entity` class per dimension) live in
`infrastructure/persistence/typeorm/entities/embedding-vector-entity.factory.ts`.
`EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION` (a `Map<number, EntityClass>`
derived from the registry) is registered wholesale in
`TypeOrmModule.forFeature([...])`.

### Why split the vector out, not duplicate the whole row per dimension

Splitting only the vector column means every non-vector index/FK/delete
path is defined exactly once. Deleting from the (single, unchanged)
`embeddings` table cascades to whichever dimension table actually holds
the corresponding vector — the caller never needs to know or pass a
dimension to delete something. See "Repositories" below.

## Repositories

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

- **`saveMany`** is the only insert path, and the only write that needs an
  explicit `dimensions` — it writes the `embeddings` metadata row and the
  matching `embedding_vectors_{dimensions}` row in **one DB transaction**,
  correlated by the aggregate's already client-generated id (no extra round
  trip). Throws `NoEmbeddingTableForDimensionException` if `dimensions`
  isn't in `EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION`.
- **`deleteByDocumentId`/`deleteByKnowledgeBaseId`** deliberately take NO
  dimension — they delete from `embeddings` only, relying on
  `ON DELETE CASCADE` to remove the row from whichever
  `embedding_vectors_{dimension}` table actually holds it. This is why the
  three cleanup listeners below need no cross-context knowledge of a
  Knowledge Base's current embedding model at all.
- **`deleteByKnowledgeBaseIdAndModel`** filters by the `model` column (never
  by dimension) — used only by the re-embed pipeline, to clear exactly one
  model's rows for a tenant while leaving another model's rows (old or new,
  possibly sharing a vector table) untouched.
- **`search`** resolves `dimensions` to pick which
  `embedding_vectors_{dimension}` table to `JOIN` against before the
  `ORDER BY ... <=> ...` runs.

## Embedding pipeline

```
documents' ChunkDocumentProcessor completes
     │  emits DocumentChunkedEvent
     ▼
DocumentChunkedListener ──> EmbeddingProcessingQueuePort.enqueueEmbedding()
     │
     ▼
BullMQ "embeddings" queue
     │
     ▼
EmbedDocumentChunksProcessor.process(job)
     ├─ opens its own KnowledgeBaseContext frame (no HTTP request here)
     ├─ KnowledgeBaseEmbeddingConfigPort.getByKnowledgeBaseId(knowledgeBaseId)
     ├─ EmbeddingModelRegistryService.getOrThrow(config.embeddingModel) → dimensions
     ├─ ChunkSourcePort.findByDocumentId(documentId)   — via documents' QueryBus
     ├─ EmbeddingPort.embedBatch(texts, config.embeddingModel)   — one HTTP call
     └─ EmbeddingWriteRepo.saveMany(embeddings, dimensions)      — tenant-scoped
```

This step runs regardless of the Knowledge Base's `embeddingStatus` — a
document's own chunk→embed flow is independent of another, possibly
concurrent, model-change re-embed for the same tenant (see "Re-embedding
pipeline" below; a document ingested mid-re-embed simply embeds under
whichever model is *current* at that instant).

Like `documents`' `ChunkDocumentProcessor`, the processor opens its own
`KnowledgeBaseContext` frame explicitly — there is no HTTP request inside
a BullMQ job for `KnowledgeBaseContextInterceptor` to have already handled.

### Cleanup listeners

Three more listeners keep this context's data consistent with `documents`
and `knowledge-bases`, each running synchronously (no queue — these are
fast, DB-only deletes, unlike the embedding pipeline itself). None of them
needs any cross-context knowledge of a Knowledge Base's current embedding
model — see "Repositories" above for why:

- `DocumentChunkingStartedListener` — fires on every chunking run,
  including re-chunks after a content update; clears stale embeddings
  before the new chunks are written.
- `DocumentDeletedListener` — clears a deleted document's embeddings.
- `KnowledgeBaseDeletedListener` — clears an entire deleted tenant's
  embeddings, independently of `documents`' own cascade (relying on
  cross-context delete ordering would be a hidden coupling).

## Re-embedding pipeline

Changing a Knowledge Base's `embeddingModel` (`ChangeKnowledgeBaseEmbeddingModel`,
owned by `knowledge-bases`) moves it into `embeddingStatus = REEMBEDDING`
and publishes `KnowledgeBaseEmbeddingModelChangeRequestedEvent`. This
context reacts to it entirely from `infrastructure/`:

```
KnowledgeBaseEmbeddingModelChangeRequestedEvent (from knowledge-bases)
     ▼
KnowledgeBaseEmbeddingModelChangedListener (infrastructure/adapters/)
     └─> IEmbeddingReembedQueuePort.enqueueReembed(knowledgeBaseId, previousModel, newModel)
              │  same "embeddings" BullMQ queue as the embed pipeline, new job name
              ▼
ReembedKnowledgeBaseProcessor.process(job)   — routed to by job.name, see below
knowledgeBaseContext.run(knowledgeBaseId, async () => {
     ├─ EmbeddingWriteRepo.deleteByKnowledgeBaseIdAndModel(knowledgeBaseId, newModel)
     │     # clears any partial rows from a previously failed attempt at
     │     # this same target model — every attempt is a clean rewrite
     ├─ documentIds = ChunkSourcePort.findKnowledgeBaseDocumentIds(knowledgeBaseId)
     ├─ for each documentId, sequentially:
     │     ├─ chunks = ChunkSourcePort.findByDocumentId(documentId)
     │     ├─ vectors = EmbeddingPort.embedBatch(texts, newModel)
     │     └─ EmbeddingWriteRepo.saveMany(built EmbeddingAggregate[], newDimensions)
     ├─ EmbeddingWriteRepo.deleteByKnowledgeBaseIdAndModel(knowledgeBaseId, previousModel)
     │     # only after every document succeeded — avoids a partial state
     │     # where some documents are searchable and others have zero
     │     # embeddings if the job fails partway
     └─ on success: IKnowledgeBaseReembeddingStatusPort.complete(knowledgeBaseId)
        on any error: ...fail(knowledgeBaseId, reason), then rethrow
})
```

`documents` exposes a new internal-only
`DocumentFindIdsByKnowledgeBaseIdQuery` for the "enumerate every document
this tenant has" step — the pre-existing `ChunkFindByDocumentIdQuery` only
ever supported per-document lookup, which was sufficient before this
change (only ever one document embedded at a time).

### Why `ReembedKnowledgeBaseProcessor` isn't its own `@Processor`

It shares the `embeddings` BullMQ queue with the normal embed pipeline (a
new job name, not a new queue), but it is a plain injectable, NOT its own
`@Processor('embeddings') extends WorkerHost`. Running two independent
`Worker` instances against the same queue name means either one could pick
up either job type — BullMQ has no per-job-type routing across multiple
Workers sharing a queue — which could hand a re-embed job's payload to code
that only knows how to read an `EmbedDocumentChunksJobData` shape, or vice
versa. Instead, `EmbedDocumentChunksProcessor` (the sole registered
`@Processor('embeddings')`) inspects `job.name` and routes re-embed jobs to
an injected `ReembedKnowledgeBaseProcessor.process(job)`.

`IKnowledgeBaseReembeddingStatusPort` (`application/ports/`,
`infrastructure/adapters/knowledge-base-reembedding-status.adapter.ts`) is
the seam `ReembedKnowledgeBaseProcessor` uses to report success/failure —
dispatching `knowledge-bases`' internal
`CompleteKnowledgeBaseReembeddingCommand`/`FailKnowledgeBaseReembeddingCommand`
through the global `CommandBus`, never importing those commands directly
from outside `infrastructure/adapters/`.

## Cross-context chunk read

This context needs chunk **text** to embed it, but `Chunk` is owned by
`documents`. There is no cross-context module import here — `documents`
exposes internal-only `ChunkFindByDocumentIdQuery` (per-document) and
`DocumentFindIdsByKnowledgeBaseIdQuery` (per-tenant, for the re-embed
pipeline), and `DocumentChunkSourceAdapter` (`infrastructure/adapters/` —
the ESLint-permitted seam) dispatches both through the global `QueryBus`.

## Cross-context: Knowledge Base embedding config

Both the embed pipeline and search need, for a given `knowledgeBaseId`, the
current `embeddingModel` (to pass to `IEmbeddingPort`) and `embeddingStatus`
(to gate search). `IKnowledgeBaseEmbeddingConfigPort`
(`application/ports/knowledge-base-embedding-config.port.ts`), implemented
by `KnowledgeBaseEmbeddingConfigAdapter`
(`infrastructure/adapters/`), dispatches `knowledge-bases`'
`KnowledgeBaseFindByIdQuery` (extended with both fields) through the global
`QueryBus`. Deletes never resolve this port — see "Repositories" above.

## Cross-context search capability

`retrieval` needs semantic search but owns none of the embedding data or
generation logic. This context exposes exactly one internal-only,
no-transport capability for that: `EmbeddingSearchQuery` — takes free text
and a `topK`, resolves the Knowledge Base's embedding config, rejects with
`EmbeddingSearchNotReadyException` (surfaced by the global exception
filter as HTTP 409) if `embeddingStatus !== READY`, otherwise embeds the
text via `EmbeddingPort` using the resolved model, and runs the
tenant-scoped similarity search against the resolved dimension's table.
`retrieval`'s `EmbeddingSearchAdapter` (in `retrieval`'s own
`infrastructure/adapters/`) dispatches it through the global `QueryBus` —
the same established cross-context pattern used everywhere else in this
codebase (mirrored from the sibling `gardenia-api` service's
`CareLogAdapter`): a context's own `.module.ts` can never import another
context's module (ESLint's `boundaries/element-types` rule would reject
it), so cross-context reads/writes always go through a dispatched
Command/Query class instead of an injected repository token.

## `IEmbeddingPort`

```ts
export interface IEmbeddingPort {
  embed(text: string, model: string): Promise<number[]>;
  embedBatch(texts: string[], model: string): Promise<number[][]>;
}
```

`model` is explicit on every call — every caller already resolves a
per-Knowledge-Base model before calling anyway (to also resolve the vector
table dimension), so there is no implicit/global fallback model.
`OpenAiCompatibleEmbeddingService` sends whatever `model` it's given in the
request body; it holds no model configuration of its own.

## pgvector

Each generated `EmbeddingVectorTypeOrmEntity` subclass's `embedding` column
uses TypeORM's **native** `vector` column type — the pinned TypeORM version
round-trips `number[]` through Postgres' `vector` text format
automatically, so no extra npm dependency was needed. Similarity search
still requires raw SQL: `EmbeddingTypeOrmReadRepository.search()`
hand-builds a JOIN against the resolved `embedding_vectors_{dimensions}`
table and an `ORDER BY vector.embedding <=> :queryVector` fragment
(TypeORM's QueryBuilder has no DSL for pgvector's distance operators),
binding the query vector as a parameter — never string-interpolated. Uses
cosine distance, matching how most embedding models (including OpenAI's)
are trained/evaluated; `score` returned to callers is `1 - cosine_distance`
(higher = more similar).

## Guardrail env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `EMBEDDINGS_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible embeddings endpoint — works against OpenAI, Ollama, LM Studio, etc. |
| `EMBEDDINGS_API_KEY` | (empty) | Bearer token for the embeddings endpoint |

There is no `EMBEDDINGS_MODEL` env var — the model is a per-Knowledge-Base
setting (`embeddingModel`, chosen from `EMBEDDING_MODELS_REGISTRY` at
`POST /knowledge-bases` time and changeable via
`PATCH /knowledge-bases/me/embedding-model`), not a global instance-wide
default.

## Database

Tables:
- `embeddings` (migration `1780000000003-CreateEmbeddings`, altered by
  `1780000000005-DropEmbeddingColumnFromEmbeddings`) — metadata only now.
  Indexed on `knowledge_base_id`, `document_id`.
- `embedding_vectors_768`, `embedding_vectors_1024`,
  `embedding_vectors_1536`, `embedding_vectors_3072` (migration
  `1780000000006-CreateEmbeddingVectorTables`) — each `embedding_id` (PK,
  FK to `embeddings.id`, `ON DELETE CASCADE`) + `embedding vector(N)`, each
  with its own HNSW cosine index.

Requires the `pgvector/pgvector:pg18` Postgres image (or equivalent with
the `vector` extension installed) — a plain `postgres:18-alpine` will not
have the extension available.

## Transport surface

`GET /embeddings/models` (REST) / `embeddingModels` (GraphQL) — see "Public
'list available models' query" above. Everything else in this context
remains derived data with no direct transport of its own; the embedding
pipeline is driven entirely by `documents`' and `knowledge-bases`' events,
and public consumption of the vectors themselves happens through
`retrieval`.
