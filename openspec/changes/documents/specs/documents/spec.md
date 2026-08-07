# Spec: Document bounded context — change `documents`

Tenant-scoped document ingestion and chunking. Consumes the tenancy
mechanism built in `knowledge-bases`; produces the `Chunk` records
`retrieval` (proposed next) will embed.

---

## 1. Domain Model

### 1.1 DocumentAggregate

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | UUID | No | |
| knowledgeBaseId | UUID | No | Tenant scope |
| title | string | No | 1–255 chars |
| content | string | No | Non-empty; max `DOCUMENTS_MAX_CONTENT_LENGTH` (enforced in the command handler) |
| status | DocumentStatus | No | `PENDING`\|`CHUNKING`\|`CHUNKED`\|`FAILED` |
| failureReason | string | Yes | Set only when `status = FAILED` |
| chunkCount | number | No | 0 until `CHUNKED` |
| createdAt / updatedAt | Date | No | |

### 1.2 Status state machine

```
        create()
           │
           ▼
       PENDING ──startChunking()──> CHUNKING ──completeChunking()──> CHUNKED
           ▲                            │
           │                       failChunking()
      update()                         │
     (from CHUNKED/FAILED only)        ▼
                                     FAILED
```

- `startChunking()` MUST only be called from `PENDING`. Any other source
  state throws `DocumentInvalidStatusTransitionException` (422).
- `completeChunking(chunkCount)` / `failChunking(reason)` MUST only be
  called from `CHUNKING`.
- `update()` MUST be rejected with `DocumentInvalidStatusTransitionException`
  while `status = CHUNKING` — a client can't change content out from under
  an in-flight chunking job. Update from `CHUNKED` or `FAILED` deletes
  existing chunks and resets to `PENDING`, re-triggering the pipeline.

### 1.3 ChunkAggregate

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | UUID | No | |
| documentId | UUID | No | |
| knowledgeBaseId | UUID | No | Duplicated from the parent document — tenant queries on chunks don't require a join |
| position | number | No | >= 0, order within the document |
| text | string | No | Non-empty |
| createdAt | Date | No | |

Chunks are hydration-only (no `create()`/domain events) — they exist solely
as output of the chunking job, never created/updated directly by a client.

### 1.4 Guardrails

- `content` longer than `DOCUMENTS_MAX_CONTENT_LENGTH` (default 500 000
  chars) MUST be rejected at `CreateDocument`/`UpdateDocument` with
  `DocumentContentTooLargeException` (413), before any persistence or
  queueing.
- Chunking that would produce more than `DOCUMENTS_MAX_CHUNKS` (default
  2 000) chunks MUST throw `DocumentTooManyChunksException`, caught by the
  processor and turned into `failChunking()` — the document ends in
  `FAILED`, not left `CHUNKING` forever.

---

## 2. Async Pipeline

1. `CreateDocument`/`UpdateDocument` handler saves the document as
   `PENDING`, then calls `IDocumentProcessingQueuePort.enqueueChunking(documentId, knowledgeBaseId)`.
2. `ChunkDocumentProcessor` (BullMQ worker) picks up the job. It MUST open
   its own `KnowledgeBaseContext` frame from `job.data.knowledgeBaseId`
   before touching any tenant-scoped repository — there is no HTTP request
   here for the interceptor to have already handled it.
3. Processor calls `aggregate.startChunking()`, saves, runs
   `IChunkingStrategyPort.chunk(content)`, saves the resulting chunks,
   calls `aggregate.completeChunking(count)`, saves.
4. Any error during steps 2–3 (including the guardrail exception) MUST
   result in `aggregate.failChunking(message)` being called and saved — a
   document MUST NOT be left in `CHUNKING` if the job throws.

---

## 3. Commands

### 3.1 CreateDocument

**Inputs:** `title`, `content`; `knowledgeBaseId` from the authenticated
context (never client input).

**Rules:** `content.length` MUST NOT exceed `DOCUMENTS_MAX_CONTENT_LENGTH`.
Returns `{ id, status: PENDING }` immediately — chunking has not run yet.

### 3.2 UpdateDocument

**Inputs:** `id`, optional `title`/`content`.

**Rules:** Document MUST exist in the caller's knowledge base (404
otherwise — tenant repo scoping makes cross-tenant access indistinguishable
from not-found). MUST be rejected if `status = CHUNKING`. On success,
existing chunks are deleted, status resets to `PENDING`, a new chunking job
is enqueued.

### 3.3 DeleteDocument

**Inputs:** `id`.

**Rules:** Deletes all chunks for the document, then the document itself.

### 3.4 DeleteDocumentsByKnowledgeBaseId (internal, no transport surface)

**Inputs:** `knowledgeBaseId`.

**Rules:** Dispatched only by `KnowledgeBaseDeletedListener`. Deletes every
document (and their chunks) for the given tenant. Runs inside its own
`knowledgeBaseContext.run()` frame — triggered by an event, not a guarded
request.

---

## 4. Queries

### 4.1 DocumentFindById

Returns the caller's own document (404 across tenants, same mechanism as
`knowledge-bases`).

### 4.2 DocumentFindByCriteria

Standard mandatory Criteria pattern — filterable by `status`, `title`
(LIKE), `createdAt` range; sortable; paginated. This is a normal,
non-deviant application of the pattern (contrast with `knowledge-bases`,
where the pattern was deliberately omitted for auth-model reasons that
don't apply here — one authenticated tenant legitimately has many
documents).

---

## 5. Cross-context: KnowledgeBaseDeletedListener

```ts
// src/contexts/documents/infrastructure/adapters/knowledge-base-deleted.listener.ts
@EventsHandler(KnowledgeBaseDeletedEvent) // from @contexts/knowledge-bases/domain/events/
export class KnowledgeBaseDeletedListener
  implements IEventHandler<KnowledgeBaseDeletedEvent>
{
  handle(event: KnowledgeBaseDeletedEvent): Promise<void> {
    // dispatches DeleteDocumentsByKnowledgeBaseIdCommand with event.data.id
  }
}
```

Lives in `infrastructure/adapters/` specifically because it imports a class
from `@contexts/knowledge-bases/` — the ESLint-enforced boundary seam.

---

## 6. Transport

### 6.1 REST (prefix `api/documents`)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/` | KnowledgeBaseApiKeyGuard | Create; returns `PENDING` |
| GET | `/:id` | KnowledgeBaseApiKeyGuard | Get by id |
| GET | `/` | KnowledgeBaseApiKeyGuard | List (Criteria) |
| PATCH | `/:id` | KnowledgeBaseApiKeyGuard | Update; re-triggers chunking |
| DELETE | `/:id` | KnowledgeBaseApiKeyGuard | Delete + cascade chunks |

### 6.2 GraphQL

`createDocument`, `updateDocument`, `deleteDocument` (mutations);
`documentFindById`, `documentFindByCriteria` (queries). All guarded.

### 6.3 MCP

`document_create`, `document_find_by_id`, `document_find_by_criteria`,
`document_delete` — exposed (contrast with `knowledge-bases`' deliberate
omission; nothing here is credential-adjacent).

---

## 7. Scenarios

### SC-01 Create — happy path
**Given** an authenticated knowledge base
**When** `POST /documents {title, content}`
**Then** HTTP 201, `status: "PENDING"`, `DocumentCreated` event dispatched,
a chunking job enqueued.

### SC-02 Create — content too large
**Given** `content.length > DOCUMENTS_MAX_CONTENT_LENGTH`
**When** creating a document
**Then** HTTP 413, `DocumentContentTooLargeException`; no document
persisted, no job enqueued.

### SC-03 Chunking completes successfully
**Given** a `PENDING` document within guardrail limits
**When** the processor picks up its job
**Then** status transitions `PENDING`→`CHUNKING`→`CHUNKED`, `chunkCount`
matches the number of persisted chunks, chunks are ordered by `position`.

### SC-04 Chunking fails — guardrail
**Given** content that would produce more than `DOCUMENTS_MAX_CHUNKS`
**When** the processor runs
**Then** status ends `FAILED` with a reason, zero chunks persisted (not a
partial set).

### SC-05 Update rejected while chunking
**Given** a document with `status = CHUNKING`
**When** `PATCH /documents/:id` is called
**Then** HTTP 422, `DocumentInvalidStatusTransitionException`.

### SC-06 Update re-triggers chunking
**Given** a `CHUNKED` document with existing chunks
**When** its content is updated
**Then** old chunks are deleted, status resets to `PENDING`, a new job is
enqueued.

### SC-07 Tenant isolation
**Given** document D1 in knowledge base KB1
**When** a caller authenticated as KB2 requests D1 (get/update/delete/list)
**Then** D1 is invisible (404 / absent from list).

### SC-08 KnowledgeBase deletion cascades
**Given** knowledge base KB1 with documents D1, D2 (each with chunks)
**When** KB1 is deleted
**Then** D1, D2, and all their chunks are deleted; a subsequent
`GET /documents/:id` for either (even with a — now invalid — KB1 key)
returns 401 (key no longer resolves) rather than reaching the document
layer at all.

### SC-09 findByCriteria filters by status
**Given** 3 documents: 2 `CHUNKED`, 1 `FAILED`
**When** `documentFindByCriteria(filters: [{field: STATUS, value: CHUNKED}])`
**Then** returns exactly the 2 `CHUNKED` documents.

### SC-10 Processor tenancy isolation
**Given** two chunking jobs queued for different knowledge bases,
processed concurrently
**When** each processor invocation runs
**Then** each only ever reads/writes documents/chunks scoped to its own
job's `knowledgeBaseId` — verified via `KnowledgeBaseContext` ALS
isolation (already covered generically in `knowledge-bases`' SC-11; this
scenario is the same guarantee under a real consumer).
