# `documents`

Ingests plain text / Markdown documents into a knowledge base and drives them
through an async chunking pipeline, producing the `Chunk`s the future
`retrieval` context will embed and search over.

## Aggregates

### `DocumentAggregate`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `knowledgeBaseId` | UUID | Tenant; injected by the tenant repository |
| `title` | string | 1–255 chars |
| `content` | string | Non-empty; max `DOCUMENTS_MAX_CONTENT_LENGTH`, enforced in the command handler, not the value object (an operational guardrail, not a domain rule) |
| `status` | `DocumentStatusEnum` | `PENDING` \| `CHUNKING` \| `CHUNKED` \| `FAILED` |
| `failureReason` | string \| null | Set when `status = FAILED` |
| `chunkCount` | number | Set on `CHUNKED` |

Status state machine:

```
PENDING ──startChunking()──▶ CHUNKING ──completeChunking(n)──▶ CHUNKED
                                 │
                                 └──failChunking(reason)──▶ FAILED
```

`update()` is rejected with `DocumentInvalidStatusTransitionException` while
`status = CHUNKING` — a document can't be edited mid-pipeline. Updating the
`content` of a `CHUNKED`/`FAILED` document resets it to `PENDING` and its
existing chunks are deleted by the command handler, ready to be re-enqueued.

### `ChunkAggregate`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `documentId` | UUID | |
| `knowledgeBaseId` | UUID | Denormalized for direct tenant-scoped queries |
| `position` | number | 0-based order within the document |
| `text` | string | Non-empty |
| `createdAt` | Date | No `updatedAt` — chunks are immutable |

Hydration-only, plain class (not a `BaseAggregate`) — chunks have exactly one
producer (`ChunkDocumentProcessor`), no domain events, and no independent
lifecycle reachable from transport.

## Commands

- `CreateDocument` — builds a `PENDING` document, saves it, enqueues a
  chunking job, returns `{ id, status }`. Rejects with
  `DocumentContentTooLargeException` (413) over `DOCUMENTS_MAX_CONTENT_LENGTH`.
- `UpdateDocument` — rejects while `CHUNKING` (422); otherwise replaces
  title/content, deletes existing chunks and re-enqueues chunking if content
  changed.
- `RechunkDocument` — rejects while `CHUNKING` (422); otherwise forces the
  document back to `PENDING` (clearing `chunkCount`/`failureReason`), deletes
  any existing chunk rows, and re-enqueues chunking under the document's
  **current** content — no content change required, unlike `UpdateDocument`.
  Recovers a document whose `chunks` rows are missing or stale despite a
  `CHUNKED` status (e.g. a bad import/seed), the same "force" need
  `knowledge-bases`' `ReembedKnowledgeBase` addresses for stuck embeddings.
  Retryable from `FAILED`.
- `DeleteDocument` — deletes the document's chunks, then the document.
- `DeleteDocumentsByKnowledgeBase` — **internal only**, no transport surface.
  Used exclusively by `KnowledgeBaseDeletedListener` for the cascade below.

## Queries

- `DocumentFindById`
- `DocumentFindByCriteria` — implemented normally (unlike `knowledge-bases`'
  deliberate omission): one authenticated knowledge base legitimately has
  many documents to list, which is exactly this pattern's intended use.

## Chunking pipeline

```
POST /documents ──▶ CreateDocumentCommandHandler ──▶ save (PENDING)
                                                    ──▶ enqueueChunking()
                                                            │
                                                            ▼
                                              BullMQ "documents" queue
                                                            │
                                                            ▼
                                          ChunkDocumentProcessor.process(job)
                                          ├─ startChunking()      (→ CHUNKING)
                                          ├─ RecursiveChunkingService.chunk()
                                          ├─ ChunkWriteRepo.saveMany()
                                          └─ completeChunking(n)  (→ CHUNKED)
                                             or failChunking(msg) (→ FAILED)
```

`RecursiveChunkingService` (the default `ChunkingStrategyPort`) splits
paragraph-first (`\n\n` → `\n` → sentence → hard char split), then merges
undersized segments toward a ~1000-char target with ~150-char overlap
carried into the next chunk. Throws `DocumentTooManyChunksException` (422)
if the result exceeds `DOCUMENTS_MAX_CHUNKS`.

### The processor opens its own tenancy frame

Every other transport in this codebase resolves `knowledgeBaseId` via
`KnowledgeBaseContextInterceptor`, which opens the `KnowledgeBaseContext` ALS
frame around the HTTP request. **There is no HTTP request inside a BullMQ
job** — `ChunkDocumentProcessor.process()` is the one place in this context
that must call `knowledgeBaseContext.run(job.data.knowledgeBaseId, ...)`
itself, wrapping the entire job body so every repository call inside it is
correctly tenant-scoped. `KnowledgeBaseDeletedListener` does the same, for
the same reason: it fires from an event bus dispatch, not a guarded request.

On any thrown error mid-pipeline (including
`DocumentTooManyChunksException`), the processor calls `failChunking(reason)`
and re-throws — the document's status always reflects the outcome, even
though re-throwing also marks the BullMQ job itself as failed for
observability.

## `KnowledgeBaseDeleted` cascade

`KnowledgeBaseDeletedListener` (`infrastructure/adapters/`) subscribes to
`KnowledgeBaseDeletedEvent`, imported from `@contexts/knowledge-bases/domain/events/`
— the ESLint-enforced seam for reaching another context's domain class.
Dispatches `DeleteDocumentsByKnowledgeBaseCommand`, which pages through and
deletes every document (and its chunks) for the deleted knowledge base.

## MCP tools

Exposed — `document_create`, `document_find_by_id`,
`document_find_by_criteria`, `document_delete`, `document_rechunk`. Nothing here is
credential/session material (contrast with `knowledge-bases`, which has none
by design), so `AGENTS.md`'s MCP exposure decision is "yes." Tenancy for MCP
calls is resolved by `McpContextBuilder` (`src/core/mcp/`), which reads
`X-API-Key` the same way `KnowledgeBaseApiKeyGuard` does for REST/GraphQL.

## Guardrail env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `DOCUMENTS_MAX_CONTENT_LENGTH` | 500000 | Max `content` length in chars, enforced in `CreateDocument`/`UpdateDocument` |
| `DOCUMENTS_MAX_CHUNKS` | 2000 | Max chunks a single document may produce, enforced in `RecursiveChunkingService` |

Both are self-hosted-operator-tunable — deployments with tighter
Redis/Postgres/worker capacity can lower them without a code change.

## Database

Tables: `documents`, `chunks` (migration `1780000000002-CreateDocuments`).
Both indexed on `knowledge_base_id`; `chunks` additionally indexed on
`document_id`.
