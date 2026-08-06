# `retrieval`

Tenant-scoped semantic search over `documents`' chunks — the last of the
three MVP bounded contexts. Turns a natural-language query into the most
relevant chunks via an embedding + pgvector similarity search pipeline.

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
| `embedding` | number[] | Fixed length 1536 — see "Fixed embedding dimension" below |
| `model` | string | The embedding model that produced this vector |
| `createdAt` | Date | No `updatedAt` — a re-embed deletes and re-creates |

## Embedding pipeline

```
documents' ChunkDocumentProcessor completes
     │  emits DocumentChunkedEvent
     ▼
DocumentChunkedListener ──> EmbeddingProcessingQueuePort.enqueueEmbedding()
     │
     ▼
BullMQ "retrieval" queue
     │
     ▼
EmbedDocumentChunksProcessor.process(job)
     ├─ opens its own KnowledgeBaseContext frame (no HTTP request here)
     ├─ ChunkSourcePort.findByDocumentId(documentId)   — via documents' QueryBus
     ├─ EmbeddingPort.embedBatch(texts)                — one HTTP call
     └─ EmbeddingWriteRepo.saveMany(embeddings)         — tenant-scoped
```

Like `documents`' `ChunkDocumentProcessor`, the processor opens its own
`KnowledgeBaseContext` frame explicitly — there is no HTTP request inside
a BullMQ job for `KnowledgeBaseContextInterceptor` to have already handled.

### Cleanup listeners

Three more listeners keep this context's data consistent with `documents`
and `knowledge-bases`, each running synchronously (no queue — these are
fast, DB-only deletes, unlike the embedding pipeline itself):

- `DocumentChunkingStartedListener` — fires on every chunking run,
  including re-chunks after a content update; clears stale embeddings
  before the new chunks are written.
- `DocumentDeletedListener` — clears a deleted document's embeddings.
- `KnowledgeBaseDeletedListener` — clears an entire deleted tenant's
  embeddings, independently of `documents`' own cascade (relying on
  cross-context delete ordering would be a hidden coupling).

## Cross-context chunk read

`retrieval` needs chunk **text** to embed it, but `Chunk` is owned by
`documents`. There is no cross-context module import here — `documents`
exposes an internal-only `ChunkFindByDocumentIdQuery` (no transport
surface), and `retrieval`'s `DocumentChunkSourceAdapter`
(`infrastructure/adapters/` — the ESLint-permitted seam) dispatches it
through the global `QueryBus`. This is the established cross-context
pattern in this codebase (mirrored from the sibling `gardenia-api`
service's `CareLogAdapter`): a context's own `.module.ts` can never import
another context's module (ESLint's `boundaries/element-types` rule would
reject it — a module's `imports: [...]` array lives at the context root,
not inside `infrastructure/adapters/**`), so cross-context reads/writes
always go through a dispatched Command/Query class instead of an injected
repository token.

## pgvector

`EmbeddingTypeOrmEntity.embedding` uses TypeORM's **native** `vector`
column type — the pinned TypeORM version round-trips `number[]` through
Postgres' `vector` text format automatically, so no extra npm dependency
was needed. Similarity search still requires raw SQL:
`EmbeddingTypeOrmReadRepository.search()` hand-builds an
`ORDER BY embedding <=> :queryVector` fragment (TypeORM's QueryBuilder has
no DSL for pgvector's distance operators), binding the query vector as a
parameter — never string-interpolated. Uses cosine distance, matching how
most embedding models (including OpenAI's) are trained/evaluated; `score`
returned to callers is `1 - cosine_distance` (higher = more similar).

### Fixed embedding dimension

pgvector requires a fixed column width per table. `1536` (OpenAI
`text-embedding-3-small`/`ada-002`'s dimension) is hardcoded in both the
migration and `EmbeddingVectorValueObject`. Switching to a
differently-dimensioned embedding model requires a new migration — this
is not solved generically in the MVP (see `openspec/changes/retrieval/design.md`
Open Questions).

## Query

`RetrievalSearch` — the only public surface this context exposes.
Embeds the query text, runs a tenant-scoped cosine-similarity search,
returns ranked chunks. REST (`POST /retrieval/search`), GraphQL
(`retrievalSearch`), and an MCP tool (`retrieval_search`) — this context's
entire purpose is to be AI-callable, so nothing here is held back from MCP
(contrast with `knowledge-bases`, which has none by design).

## Guardrail env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `RETRIEVAL_EMBEDDING_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible embeddings endpoint — works against OpenAI, Ollama, LM Studio, etc. |
| `RETRIEVAL_EMBEDDING_API_KEY` | (empty) | Bearer token for the embeddings endpoint |
| `RETRIEVAL_EMBEDDING_MODEL` | `text-embedding-3-small` | Must match the fixed 1536-dimension column |
| `RETRIEVAL_SEARCH_TOP_K_DEFAULT` | 5 | Results returned when `topK` is omitted |
| `RETRIEVAL_SEARCH_TOP_K_MAX` | 20 | Hard cap on `topK`, regardless of what a caller requests |

## Database

Table: `embeddings` (migration `1780000000003-CreateEmbeddings`). Requires
the `pgvector/pgvector:pg18` Postgres image (or equivalent with the
`vector` extension installed) — a plain `postgres:18-alpine` will not
have the extension available. Indexed on `knowledge_base_id`,
`document_id`, and an HNSW cosine index on `embedding` for approximate
nearest-neighbor search.
