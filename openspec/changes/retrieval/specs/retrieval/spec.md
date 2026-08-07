# Spec: Retrieval bounded context — change `retrieval`

Tenant-scoped semantic search over `documents`' chunks. Consumes the
tenancy mechanism built in `knowledge-bases` and the chunking pipeline
built in `documents`; is the last of the three MVP contexts.

---

## 1. Domain Model

### 1.1 EmbeddingAggregate

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | UUID | No | |
| knowledgeBaseId | UUID | No | Tenant scope |
| documentId | UUID | No | |
| chunkId | UUID | No | |
| chunkText | string | No | Denormalized from the source chunk at embed time |
| chunkPosition | number | No | Denormalized from the source chunk |
| embedding | number[] | No | Length 1536, fixed (pgvector column width) |
| model | string | No | `RETRIEVAL_EMBEDDING_MODEL` value at embed time |
| createdAt | Date | No | No `updatedAt` — embeddings are immutable; a re-embed deletes and re-creates |

Hydration-only (no `create()`/domain events) — same reasoning as `Chunk`:
one producer (`EmbedDocumentChunksProcessor`), never independently
created/updated/deleted from a transport entry point.

### 1.2 Guardrails

- `RetrievalSearch`'s `topK` MUST be clamped to `RETRIEVAL_SEARCH_TOP_K_MAX`
  (default 20) and defaults to `RETRIEVAL_SEARCH_TOP_K_DEFAULT` (default 5)
  when omitted.

---

## 2. Async Pipeline

1. `documents`' `ChunkDocumentProcessor` completes chunking and emits
   `DocumentChunkedEvent`.
2. `DocumentChunkedListener` (this context) enqueues an embedding job via
   `IEmbeddingProcessingQueuePort.enqueueEmbedding(documentId, knowledgeBaseId)`.
3. `EmbedDocumentChunksProcessor` (BullMQ worker) picks up the job. It MUST
   open its own `KnowledgeBaseContext` frame from `job.data.knowledgeBaseId`
   before touching any tenant-scoped repository — same requirement as
   `documents`' processor, for the same reason (no HTTP request here).
4. Processor fetches the document's chunks via `IChunkSourcePort`
   (backed by `documents`' exported chunk repository), embeds all chunk
   texts in one `IEmbeddingPort.embedBatch()` call, and persists the
   resulting `EmbeddingAggregate`s.

### 2.1 Cleanup

- `DocumentChunkingStartedEvent` (emitted every time `documents` starts a
  chunking run, including re-chunks after an update) MUST trigger deletion
  of any existing embeddings for that document — stale vectors from the
  previous content version must not remain searchable once re-chunking
  begins.
- `DocumentDeletedEvent` MUST trigger deletion of that document's
  embeddings.
- `KnowledgeBaseDeletedEvent` MUST trigger deletion of every embedding for
  that tenant.

Each cleanup listener runs synchronously (no queue hop) — these are
fast, DB-only deletes, unlike the embedding pipeline itself which involves
an external HTTP call.

---

## 3. Commands (all internal, no transport surface)

### 3.1 EmbedDocumentChunks

**Inputs:** `documentId`, `knowledgeBaseId`. Dispatched only by
`EmbedDocumentChunksProcessor`'s own job handling — this is the processor's
internal orchestration, not a separately dispatched command in the current
design (see design.md's file layout — the processor calls the ports
directly rather than routing through `CommandBus`, to keep the retry unit
== the BullMQ job, matching `documents`' `ChunkDocumentProcessor`, which
does the same).

### 3.2 DeleteEmbeddingsByDocument

**Inputs:** `documentId`. Dispatched by `DocumentChunkingStartedListener`
and `DocumentDeletedListener`.

### 3.3 DeleteEmbeddingsByKnowledgeBase

**Inputs:** `knowledgeBaseId`. Dispatched by `KnowledgeBaseDeletedListener`.
Runs inside its own `knowledgeBaseContext.run()` frame.

---

## 4. Queries

### 4.1 RetrievalSearch (public)

**Inputs:** `query` (string, 1–2000 chars), optional `topK` (clamped to
`RETRIEVAL_SEARCH_TOP_K_MAX`). `knowledgeBaseId` from the authenticated
context, never client input.

**Rules:** Embeds `query` via `IEmbeddingPort.embed()`, then runs a
cosine-similarity search scoped to the caller's `knowledgeBaseId`, ordered
by ascending cosine distance (`ORDER BY embedding <=> :queryVector`),
limited to `topK`. Returns `{ chunkId, documentId, chunkText,
chunkPosition, score }[]` where `score = 1 - cosine_distance` (higher is
more similar).

---

## 5. Cross-context

### 5.1 Chunk read: ChunkSourcePort

`documents` exposes an internal-only `ChunkFindByDocumentIdQuery`
(no transport surface), wrapping its existing
`findByDocumentId(documentId): Promise<ChunkAggregate[]>` repository
method. `retrieval`'s own `document-chunk-source.adapter.ts` (in
`infrastructure/adapters/` — the ESLint-permitted seam) implements a
local `ChunkSourcePort` by dispatching that query through the global
`QueryBus` — the established cross-context read pattern in this
codebase — mapping the result to the minimal shape `retrieval` actually
needs (`{id, text, position}[]`).

### 5.2 Event listeners

```ts
// src/contexts/retrieval/infrastructure/adapters/document-chunked.listener.ts
@EventsHandler(DocumentChunkedEvent) // from @contexts/documents/domain/events/
export class DocumentChunkedListener implements IEventHandler<DocumentChunkedEvent> {
  handle(event: DocumentChunkedEvent): Promise<void> {
    // enqueues an embedding job with event.data.id (documentId) and event.data.knowledgeBaseId
  }
}
```

Three more listeners follow the identical shape for
`DocumentChunkingStartedEvent`, `DocumentDeletedEvent` (both from
`@contexts/documents/`), and `KnowledgeBaseDeletedEvent` (from
`@contexts/knowledge-bases/`).

---

## 6. Transport

### 6.1 REST (prefix `api/retrieval`)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/search` | KnowledgeBaseApiKeyGuard | Semantic search, returns ranked chunks |

### 6.2 GraphQL

`retrievalSearch` query only. Guarded.

### 6.3 MCP

`retrieval_search` — exposed; this context's entire purpose is to be
AI-callable (nothing credential-adjacent, same reasoning as `documents`'
MCP tools).

---

## 7. Scenarios

### SC-01 Search — happy path
**Given** a knowledge base with embedded chunks
**When** `POST /retrieval/search {query: "..."}`
**Then** HTTP 200, results ordered by descending `score`, length `<=`
`RETRIEVAL_SEARCH_TOP_K_DEFAULT` when `topK` was omitted.

### SC-02 Search — topK clamped
**Given** `topK` larger than `RETRIEVAL_SEARCH_TOP_K_MAX`
**When** searching
**Then** at most `RETRIEVAL_SEARCH_TOP_K_MAX` results returned, no error.

### SC-03 Tenant isolation
**Given** knowledge base KB1 with embedded document D1, KB2 with no
documents
**When** KB2 searches
**Then** zero results — KB1's embeddings never appear, even for a query
that would score highly against D1's content.

### SC-04 Embedding pipeline runs after chunking completes
**Given** a document finishes chunking (`DocumentChunked` emitted)
**When** the embedding job processes
**Then** one `EmbeddingAggregate` exists per chunk, each with the chunk's
`text`/`position` denormalized and a non-empty `embedding` vector.

### SC-05 Re-chunk clears stale embeddings
**Given** a `CHUNKED` document with existing embeddings
**When** its content is updated (triggering `documents`' re-chunk, which
emits `DocumentChunkingStarted`)
**Then** the previous embeddings are deleted before the new chunking run
persists new chunks — no window where stale and fresh embeddings coexist
for the same document.

### SC-06 Document deletion cascades
**Given** a document D1 with embeddings
**When** D1 is deleted
**Then** all of D1's embeddings are deleted.

### SC-07 KnowledgeBase deletion cascades
**Given** knowledge base KB1 with multiple embedded documents
**When** KB1 is deleted
**Then** every embedding for KB1 is deleted, independent of whatever order
`documents`' own cascade runs in.

### SC-08 Processor tenancy isolation
**Given** two embedding jobs queued for different knowledge bases,
processed concurrently
**When** each processor invocation runs
**Then** each only ever reads/writes embeddings scoped to its own job's
`knowledgeBaseId` — the same `KnowledgeBaseContext` ALS isolation guarantee
already covered generically in `knowledge-bases`' SC-11 and exercised by a
real second consumer in `documents`' SC-10.
