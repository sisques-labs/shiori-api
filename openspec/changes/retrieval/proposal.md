# Proposal: Retrieval bounded context

## Why

`documents` (stacked, not yet merged) gets text into Shiori and chunks it,
but nothing is *searchable* yet — the chunks just sit in Postgres. This
change adds the second half of the RAG pipeline (ingest → chunk →
**embed → retrieve**): every chunk gets an embedding vector, and a search
endpoint turns a natural-language query into the most relevant chunks for
an LLM (or a human) to consume. This is the last of the three contexts
scoped in the original MVP debate (`knowledge-bases`, `documents`,
`retrieval`) — once this merges, Shiori is a working open-source RAG
platform end to end.

## What Changes

- New tenant-scoped **`retrieval`** bounded context with an
  `EmbeddingAggregate` (hydration-only, one per chunk — mirrors `documents`'
  `ChunkAggregate`: derived data, single producer, no public CRUD).
- `EmbeddingPort` — hexagonal seam for turning text into a vector, default
  adapter calls an **OpenAI-compatible embeddings endpoint**
  (`POST {base_url}/embeddings`), configurable base URL/API key/model/
  dimensions so any compatible server works (OpenAI itself, Ollama, LM
  Studio, etc.) — the MVP decision from the original debate.
- **pgvector** for vector storage and similarity search — the other MVP
  decision. TypeORM (the version pinned in this repo) has native `vector`
  column support (bidirectional `number[]` ⇄ pgvector text format), so no
  new npm dependency is needed — only a Postgres image swap to one that
  ships the `vector` extension, and a hand-written `ORDER BY embedding <=>
  :query` fragment for similarity ranking (TypeORM's query builder has no
  DSL for pgvector's distance operators).
- Async embedding pipeline, mirroring `documents`' chunking pipeline
  exactly: `DocumentChunkedListener` (consumes `documents`' `DocumentChunked`
  event) enqueues a BullMQ job on a new `retrieval` queue;
  `EmbedDocumentChunksProcessor` fetches the chunks, embeds them in a batch,
  and persists the vectors.
- Cross-context chunk read: `documents` exports its existing
  `IChunkWriteRepository` (already has `findByDocumentId`) from
  `DocumentsModule`; `retrieval` consumes it through its own
  `ChunkSourcePort` seam rather than reaching into `documents`' tables
  directly.
- Cleanup listeners for `DocumentChunkingStarted` (clears stale embeddings
  before re-chunking), `DocumentDeleted`, and `KnowledgeBaseDeleted` — each
  context cleans up its own data independently rather than relying on
  cross-context delete ordering.
- **One public query**: `RetrievalSearch` — embeds the query text, runs a
  tenant-scoped pgvector cosine-similarity search, returns ranked chunks
  (text, document id, position, score). REST + GraphQL + an MCP tool (the
  entire point of this context is to be AI-callable).
- Guardrails: `RETRIEVAL_SEARCH_TOP_K_MAX` caps how many results a caller
  can request.

**Deferred to future changes:**
- Answer generation / chat completion over retrieved chunks — this context
  stops at ranked chunks, matching the original MVP scope ("Ingesta +
  Retrieval only", not generation).
- Hybrid search (BM25 + vector), re-ranking, multi-vector-per-chunk
  strategies — single dense-vector cosine search only for the MVP.
- Configurable embedding model per knowledge base — one global model,
  globally configured, same simplification `documents` made for chunking
  strategy.
- Embedding model migration/re-embedding tooling — changing
  `RETRIEVAL_EMBEDDING_MODEL` after go-live does not retroactively
  re-embed existing chunks in this change.

**Out of scope:**
- Generation/chat (explicitly deferred above).
- Any UI — API-only, matching every prior context in this service.

## Capabilities

### New Capabilities

- `retrieval`: tenant-scoped semantic search over a knowledge base's
  document chunks, with an async embedding pipeline driven by `documents`'
  chunking completion.

## Impact

| Area | Impact |
|------|--------|
| `src/contexts/retrieval/` | New — full bounded context |
| `src/contexts/documents/application/queries/chunk-find-by-document-id/` | New — internal-only query `retrieval` dispatches via `QueryBus` to read chunk text without a second persistence path |
| `src/contexts/documents/documents.module.ts` | Modify — register the new query handler |
| `src/database/migrations/1780000000003-CreateEmbeddings.ts` | New — `CREATE EXTENSION vector`, `embeddings` table, HNSW index |
| `src/contexts/contexts.module.ts` | Modify — register `RetrievalModule` |
| `docker-compose.yml`, `docker-compose.test.yml` | Modify — Postgres image → `pgvector/pgvector:pg18` (adds the `vector` extension; same major version, no other behavior change) |
| `.github/workflows/ci.yml` | Modify — e2e/integration Postgres service image → `pgvector/pgvector:pg18` |
| `.env.example` | Modify — document `RETRIEVAL_EMBEDDING_*`, `RETRIEVAL_SEARCH_TOP_K_*` |

## Rollback Plan

The migration is additive — `down()` drops the `embeddings` table then the
`vector` extension. `RetrievalModule` can be unregistered from
`contexts.module.ts` independently; `documents` has zero compile-time
dependency on `retrieval` (the new query handler is inert if nothing
dispatches it). The Postgres image swap is backward compatible —
`pgvector/pgvector:pg18` is standard Postgres 18 plus the extension, so
existing non-vector tables/queries are unaffected even if this change were
rolled back after the image swap alone had shipped.
