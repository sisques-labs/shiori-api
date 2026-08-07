# Design: Retrieval bounded context

## Technical Approach

One aggregate: `EmbeddingAggregate` — hydration-only, same shape of decision
as `documents`' `ChunkAggregate` (derived data, one producer, no public
CRUD, no domain events). One row per chunk. Denormalizes `chunkText` and
`chunkPosition` from the source chunk so search results are self-contained
— no cross-context read needed at query time, only at embedding time.

Async pipeline mirrors `documents`' chunking pipeline exactly:
`documents` finishes chunking → emits `DocumentChunkedEvent` → `retrieval`'s
`DocumentChunkedListener` enqueues a BullMQ job → `EmbedDocumentChunksProcessor`
fetches the chunks, embeds them in one batched HTTP call, persists the
vectors. Same reasoning as `documents`' choice of BullMQ over inline
processing: an external HTTP call to an embeddings API needs retry/backoff,
and doing it synchronously inside an event handler would block the event
bus.

## Cross-context chunk read

`retrieval` needs chunk **text** to embed it, but `Chunk` is owned by
`documents`. Three options were considered:

1. Carry chunk text in the `DocumentChunkedEvent` payload itself.
2. Export `documents`' `CHUNK_WRITE_REPOSITORY` from `DocumentsModule` and
   inject it directly into `retrieval`'s adapter.
3. Add a new internal-only `ChunkFindByDocumentIdQuery` to `documents`,
   dispatched by `retrieval`'s adapter through the global `QueryBus`.

**Chosen: (3).** Option (2) was implemented first but rejected by
`eslint`'s `boundaries/element-types` rule: it flags cross-context
imports from anywhere except `infrastructure/adapters/**`, and a
`.module.ts`'s `imports: [...]` array — where a repository export would
have to be wired in — sits at the context root, not inside
`infrastructure/adapters/`. There is no way to satisfy both "the module
needs `DocumentsModule` in its `imports` array" and "only
`infrastructure/adapters/**` may reference another context." Checking the
sibling `gardenia-api` service confirmed the actual established pattern:
no context there ever imports another context's module directly — cross-context
reads/writes dispatch a plain Command/Query class through the global
`CommandBus`/`QueryBus` (see `care-schedule`'s `CareLogAdapter`, which
depends only on `CommandBus` and the imported `CreateCareLogEntryCommand`
class). `documents/application/queries/chunk-find-by-document-id/`
wraps the existing `IChunkWriteRepository.findByDocumentId` in exactly
this shape — internal only, no transport surface, same posture as
`DeleteDocumentsByKnowledgeBaseCommand`. `retrieval` defines its own port,
`ChunkSourcePort`, and implements it in
`infrastructure/adapters/document-chunk-source.adapter.ts` — the
ESLint-permitted seam (`infrastructure/adapters/**`) for importing another
context's provider token, mirroring how `KnowledgeBaseDeletedListener` in
`documents` imports `knowledge-bases`' event class from the same kind of
seam. Option (1) was rejected: it would require changing `DocumentAggregate.completeChunking()`
to accept and re-broadcast full chunk bodies, coupling the event's shape to
a consumer that didn't exist when `documents` was built, and bloating an
event every future consumer of `DocumentChunked` would receive whether or
not they need chunk text.

## pgvector

Both the storage engine (a Postgres MVP decision from the original debate)
and the harder infrastructure choice. Two facts made the implementation
simpler than initially scoped:

- **No new npm dependency.** The `typeorm` version pinned in this repo has
  built-in `vector` column support — `@Column({ type: 'vector', length: N })`
  round-trips `number[]` through Postgres' `vector` text format
  automatically (`PostgresDriver`'s `preparePersistedValue`/`prepareHydratedValue`).
  Verified by reading the installed driver source directly. The separate
  `pgvector` npm package (typically needed for the `pg` driver alone) is
  unnecessary here.
- **Similarity search still needs raw SQL.** TypeORM's `QueryBuilder` has no
  DSL for pgvector's distance operators (`<->` L2, `<=>` cosine,
  `<#>` inner product). `EmbeddingTypeOrmReadRepository.search()` builds the
  `ORDER BY embedding <=> :queryVector` fragment by hand, converting the
  query vector to pgvector's `[v1,v2,...]` text format with a small local
  helper (the same one-liner TypeORM's own driver uses internally — not
  worth a dependency for) and passing it as a bound parameter (never
  string-interpolated).

**Distance metric: cosine (`<=>`)**, matching how most embedding models
(including OpenAI's) are trained/evaluated. `score` returned to callers is
`1 - cosine_distance` (higher = more similar) — more intuitive than raw
distance for API consumers.

**Dimension is fixed at 1536** (OpenAI `text-embedding-3-small`/`ada-002`'s
dimension) — pgvector requires a fixed width per column, so unlike every
other guardrail in this service, this one cannot be an env var; it's baked
into the migration. Switching to a differently-dimensioned model requires a
new migration (documented as an Open Question below, not solved in this
change).

**Postgres image**: `docker-compose.yml`, `docker-compose.test.yml`, and
`.github/workflows/ci.yml`'s e2e/integration jobs all switch from
`postgres:18-alpine` to `pgvector/pgvector:pg18` — the official pgvector
image, built on the same Postgres 18 major version, adding only the
extension binary. No other behavior changes for existing tables/migrations.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|----------|--------|------------------------|-----------|
| Embedding as its own aggregate | `EmbeddingAggregate`, hydration-only, one row per chunk | Store the vector as a column on `Chunk` itself | `Chunk` belongs to `documents`; embeddings are `retrieval`'s own derived data with their own lifecycle (re-embeddable on model change, deletable independently) — mirrors why `Chunk` itself isn't embedded in `Document` |
| Chunk text access | Dispatch `documents`' internal `ChunkFindByDocumentIdQuery` via the global `QueryBus`, wrapped in a local `ChunkSourcePort` adapter | Export `CHUNK_WRITE_REPOSITORY` from `DocumentsModule` and inject directly; carry chunk bodies in `DocumentChunkedEvent` | The direct-export approach fails ESLint's boundary rule (module-level imports can't live inside `infrastructure/adapters/**`); QueryBus dispatch is the actual established cross-context pattern (see `gardenia-api`'s `CareLogAdapter`) and keeps the event schema stable/small for all consumers |
| Vector storage | pgvector `vector` column via TypeORM's native support | Raw `pgvector` npm package; store as JSON and compute similarity in application code | Native support needs zero new dependencies; application-side similarity search doesn't scale and defeats the purpose of an ANN index |
| Distance metric | Cosine (`<=>`), HNSW index with `vector_cosine_ops` | L2 (`<->`) | Matches how OpenAI-compatible embedding models are typically trained/evaluated |
| Embedding pipeline | Async via BullMQ (new `retrieval` queue), triggered by `documents`' `DocumentChunked` event | Synchronous embedding inside `CreateDocument`/inline in the event listener | An external HTTP call needs retry/backoff and shouldn't block chunking completion or the event bus, exactly `documents`' own reasoning for async chunking |
| Cleanup on re-chunk/delete | Independent listeners per lifecycle event (`DocumentChunkingStarted` → clear stale embeddings before re-chunk, `DocumentDeleted`, `KnowledgeBaseDeleted`) | Rely on `documents`' cascade to also clean up `retrieval`'s table | Each context owns cleanup of its own data; relying on cross-context delete ordering would create a hidden coupling that breaks if either context's internals change |
| Public surface | One query, `RetrievalSearch` (REST + GraphQL + MCP) | Expose embeddings via `findByCriteria` like other contexts | Embeddings are derived, single-producer data like chunks — no legitimate direct-CRUD caller, only ranked search results matter |
| Embedding dimension | Fixed 1536, hardcoded in the migration | Configurable via env var | pgvector requires a fixed column width; a "configurable" dimension would silently break on first vector of a different size — fixed-and-documented is more honest than fake-configurable |

## Data Flow

```
Embedding (async, triggered by documents' pipeline):
DocumentChunkedEvent (published by documents, after ChunkDocumentProcessor completes)
     │
DocumentChunkedListener (retrieval/infrastructure/adapters/)
     └─> EmbeddingProcessingQueuePort.enqueueEmbedding(documentId, knowledgeBaseId)
              │
              ▼
       BullMQ "retrieval" queue
              │
              ▼
EmbedDocumentChunksProcessor.process(job: { documentId, knowledgeBaseId })
     │
knowledgeBaseContext.run(knowledgeBaseId, async () => {
     ├─ ChunkSourcePort.findByDocumentId(documentId)      # via documents' exported repo
     ├─ EmbeddingPort.embedBatch(chunks.map(c => c.text)) # one HTTP call
     └─ EmbeddingWriteRepo.saveMany(embeddings)           # tenant-scoped
})

Cleanup:
DocumentChunkingStartedEvent  ──> DeleteEmbeddingsByDocumentListener  ──> clears stale embeddings before re-chunk
DocumentDeletedEvent          ──> DeleteEmbeddingsByDocumentListener  ──> clears embeddings for a deleted document
KnowledgeBaseDeletedEvent     ──> DeleteEmbeddingsByKnowledgeBaseListener ──> clears every embedding for a deleted tenant

Search (sync, public):
REST/GraphQL/MCP ──(KnowledgeBaseApiKeyGuard)──> RetrievalSearchQuery { query, topK? }
     │
QueryBus ──> Handler ──> EmbeddingPort.embed(query)                 # one HTTP call
                      ──> EmbeddingReadRepo.search(vector, topK)    # tenant-scoped, ORDER BY embedding <=> :v
                      ──> returns [{ chunkId, documentId, chunkText, chunkPosition, score }]
```

## File Changes

```
domain/
  aggregates/embedding.aggregate.ts        — hydration-only, mirrors ChunkAggregate
  value-objects/embedding-id/…
  repositories/write/embedding-write.repository.ts   — saveMany, deleteByDocumentId, deleteByKnowledgeBaseId
  repositories/read/embedding-read.repository.ts      — search(vector, topK, knowledgeBaseId)
application/
  ports/embedding.port.ts                  — embed(text): Promise<number[]>; embedBatch(texts): Promise<number[][]>
  ports/embedding-processing-queue.port.ts — enqueueEmbedding(documentId, knowledgeBaseId): Promise<void>
  ports/chunk-source.port.ts               — findByDocumentId(documentId): Promise<{id,text,position}[]>
  commands/embed-document-chunks/          — internal only
  commands/delete-embeddings-by-document/  — internal only
  commands/delete-embeddings-by-knowledge-base/ — internal only
  queries/retrieval-search/                — public
infrastructure/
  services/openai-compatible-embedding.service.ts  — default EmbeddingPort implementation
  services/bullmq-embedding-processing-queue.service.ts
  processors/embed-document-chunks.processor.ts    — WorkerHost, opens its own KnowledgeBaseContext frame
  adapters/document-chunk-source.adapter.ts        — implements ChunkSourcePort via documents' exported repo
  adapters/document-chunked.listener.ts            — @EventsHandler(DocumentChunkedEvent) from @contexts/documents/
  adapters/document-chunking-started.listener.ts   — clears stale embeddings before re-chunk
  adapters/document-deleted.listener.ts            — @EventsHandler(DocumentDeletedEvent) from @contexts/documents/
  adapters/knowledge-base-deleted.listener.ts      — @EventsHandler(KnowledgeBaseDeletedEvent) from @contexts/knowledge-bases/
  persistence/typeorm/entities/embedding.entity.ts — `embedding` column: @Column({ type: 'vector', length: 1536 })
transport/
  rest/controllers/retrieval.controller.ts         — POST /retrieval/search only
  graphql/resolvers/retrieval-queries.resolver.ts  — retrievalSearch query only
  mcp/tools/retrieval-search.tool.ts
```

Modified files:

| File | Action | Description |
|------|--------|-------------|
| `src/contexts/documents/documents.module.ts` | Modify | Register `ChunkFindByDocumentIdQueryHandler` |
| `src/contexts/documents/application/queries/chunk-find-by-document-id/` | Create | Internal-only query wrapping `IChunkWriteRepository.findByDocumentId`, dispatched by `retrieval` via `QueryBus` |
| `src/database/migrations/1780000000003-CreateEmbeddings.ts` | Create | `CREATE EXTENSION vector`, `embeddings` table, HNSW cosine index |
| `src/contexts/contexts.module.ts` | Modify | Add `RetrievalModule` |
| `docker-compose.yml`, `docker-compose.test.yml` | Modify | Postgres image → `pgvector/pgvector:pg18` |
| `.github/workflows/ci.yml` | Modify | e2e/integration Postgres service image → `pgvector/pgvector:pg18` |
| `.env.example` | Modify | `RETRIEVAL_EMBEDDING_BASE_URL`, `RETRIEVAL_EMBEDDING_API_KEY`, `RETRIEVAL_EMBEDDING_MODEL`, `RETRIEVAL_SEARCH_TOP_K_DEFAULT`, `RETRIEVAL_SEARCH_TOP_K_MAX` |

## Interfaces / Contracts

```ts
// application/ports/embedding.port.ts
export const EMBEDDING_PORT = Symbol('EMBEDDING_PORT');
export interface IEmbeddingPort {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

// application/ports/chunk-source.port.ts
export const CHUNK_SOURCE_PORT = Symbol('CHUNK_SOURCE_PORT');
export interface IChunkSourceItem { id: string; text: string; position: number }
export interface IChunkSourcePort {
  findByDocumentId(documentId: string): Promise<IChunkSourceItem[]>;
}

// application/ports/embedding-processing-queue.port.ts
export const EMBEDDING_PROCESSING_QUEUE_PORT = Symbol('EMBEDDING_PROCESSING_QUEUE_PORT');
export interface IEmbeddingProcessingQueuePort {
  enqueueEmbedding(documentId: string, knowledgeBaseId: string): Promise<void>;
}

// domain/repositories/read/embedding-read.repository.ts
export interface IRetrievalSearchResult {
  chunkId: string;
  documentId: string;
  chunkText: string;
  chunkPosition: number;
  score: number;
}
export interface IEmbeddingReadRepository {
  search(vector: number[], topK: number): Promise<IRetrievalSearchResult[]>;
}
```

## Database Schema

Table: `embeddings`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | No | PK |
| knowledge_base_id | UUID | No | Tenant; injected by tenant repo |
| document_id | UUID | No | No DB constraint, consistent with `chunks.document_id` |
| chunk_id | UUID | No | No DB constraint |
| chunk_text | text | No | Denormalized from `chunks.text` at embed time |
| chunk_position | int | No | Denormalized from `chunks.position` |
| embedding | vector(1536) | No | |
| model | varchar(100) | No | `RETRIEVAL_EMBEDDING_MODEL` value at embed time — future-proofing for a mixed-model migration, unused for filtering in this change |
| created_at | TIMESTAMPTZ | No | |

Indexes: `IDX_embeddings_knowledge_base_id`, `IDX_embeddings_document_id`,
`IDX_embeddings_embedding_hnsw` (`USING hnsw (embedding vector_cosine_ops)`).

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `EmbedDocumentChunksProcessor` (mocked chunk source + embedding port, asserts `knowledgeBaseContext.run` used), `RetrievalSearchQuery` handler (mocked embedding port + read repo), cleanup listeners, `OpenAiCompatibleEmbeddingService` (mocked HTTP) | Jest, `jest.Mocked<T>` |
| Integration | `EmbeddingTypeOrmReadRepository.search()` against real pgvector — insert known vectors, assert nearest-neighbor ordering and tenant isolation | Real Postgres (pgvector image) |
| E2E | REST + GraphQL search returns ranked results for a knowledge base with embedded documents (embedding port mocked/stubbed at the HTTP boundary — no real external API call in CI) | supertest |

## Migration / Rollout

Single additive migration; `down()` drops the `embeddings` table then the
`vector` extension (guarded — only if no other table uses it, though none
will in this service). No backfill: documents ingested before this change
merges are chunked but never embedded until `documents` re-emits
`DocumentChunked` for them (i.e., not automatically — see Open Questions).
Requires the Postgres image swap in local dev and CI.

## Open Questions

- [ ] Should merging this change trigger re-embedding of already-chunked
      documents from before `retrieval` existed? Recommendation: no
      automatic backfill in this change — self-hosted operators can
      `UpdateDocument` with the same content to force a re-chunk (which
      re-triggers `DocumentChunked`) if they need existing documents
      searchable immediately. A dedicated backfill command is future work.
- [ ] `RETRIEVAL_EMBEDDING_API_KEY` — required at boot, or only at first
      use? Recommendation: only at first use (lazy) — a self-hosted
      operator who hasn't configured an embeddings provider yet should
      still be able to run `knowledge-bases`/`documents` functionality;
      the embedding job fails per-document (`FAILED`... — actually
      `retrieval` doesn't have a document-visible failure state, see next
      question) rather than blocking the whole app from starting.
- [ ] Embeddings have no `status`/`failureReason` surfaced anywhere — if
      `EmbedDocumentChunksProcessor` fails (e.g. bad API key, rate limit),
      the document stays `CHUNKED` with no visible indication it was never
      embedded. Recommendation: acceptable for the MVP (matches the
      original debate's "keep it minimal" pattern) — BullMQ's own
      retry/DLQ plus server logs are the operator-facing signal for now;
      a future change could add a `Document`-side "indexed" flag if this
      proves insufficient in practice.
