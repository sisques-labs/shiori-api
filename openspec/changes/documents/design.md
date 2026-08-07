# Design: Document bounded context

## Technical Approach

Two aggregates in one context: `DocumentAggregate` (root, owns lifecycle
and content) and `ChunkAggregate` (child data, written only by the async
chunking job — no public command creates a chunk directly). Both are
tenant-scoped via `createTenantRepository(rawRepo, knowledgeBaseContext)` —
this context is the first real consumer of that seam built in
`knowledge-bases`.

Ingestion is async: `CreateDocument`/`UpdateDocument` persist synchronously
(fast) and enqueue a BullMQ job; a separate `WorkerHost` processor does the
actual chunking. This is the first consumer of the Redis/BullMQ core infra
added alongside this change.

**Tenancy in a queue job**: `KnowledgeBaseContext` is `AsyncLocalStorage`-backed
and normally populated by `KnowledgeBaseContextInterceptor` per HTTP/GraphQL
request — there is no request for a BullMQ job. The job payload carries
`knowledgeBaseId` explicitly, and the processor opens its own ALS frame
(`knowledgeBaseContext.run(knowledgeBaseId, () => ...)`) before touching any
tenant-scoped repository. This is the one place in this context that reads
`knowledgeBaseId` directly instead of relying on the interceptor.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|----------|--------|------------------------|-----------|
| Chunk as its own aggregate | Separate `ChunkAggregate` + repository, not a value collection inside `DocumentAggregate` | Chunks as an embedded array on Document | A document can have hundreds of chunks; loading/saving the whole aggregate for every chunk write is wasteful, and `retrieval` (next) needs to page through chunks independently without loading full documents |
| Chunk creation | No public `CreateChunk` command — chunks are written only by `ChunkDocumentProcessor` | Expose chunk CRUD | Chunks are derived data with one producer (the chunking job); a public mutation surface would let clients desync chunks from their document's content |
| Chunking algorithm | Paragraph-first recursive split (`\n\n` → `\n` → sentence), ~1000 char target, ~15% overlap, behind `ChunkingStrategyPort` | Fixed-size only; token-aware | Matches the pre-proposal debate's decision; port seam allows a token-aware or semantic strategy later without touching the pipeline |
| Async transport | BullMQ (Redis), one `documents` named queue | Kafka | Decided in the pre-proposal debate: Kafka forwarding is opt-in/no-op-when-disabled in this template — wrong dependency for a pipeline the product needs to function; BullMQ gives retries/backoff/DLQ natively |
| Tenancy inside the job | Processor reads `knowledgeBaseId` from the job payload and opens its own `knowledgeBaseContext.run()` frame | Rely on ambient context | There is no HTTP request inside a queue job — `KnowledgeBaseContextInterceptor` never runs there. The processor is the one place in this context that must resolve tenancy explicitly instead of via the interceptor |
| `KnowledgeBaseDeleted` handling | `KnowledgeBaseDeletedListener` in `documents/infrastructure/adapters/` (imports the event class from `@contexts/knowledge-bases/domain/events/`) | Poll for orphaned documents | The event already exists (built in `knowledge-bases`, unused until now); `infrastructure/adapters/` is the ESLint-enforced seam for importing another context's domain class |
| `DocumentFindByCriteria` | Implemented normally, per the mandatory Criteria pattern (queryable-field enum, filterable-fields registry, typed filter/sort inputs) | Omit like `knowledge-bases` did | `knowledge-bases`' omission was specific to single-tenant-per-key auth having no legitimate "list across tenants" caller. Here, one authenticated knowledge base legitimately has many documents — this is exactly the pattern's intended use, not the exception |
| Guardrails | `DOCUMENTS_MAX_CONTENT_LENGTH` (default 500 000 chars), `DOCUMENTS_MAX_CHUNKS` (default 2 000), both env-configurable | Hard-coded limits | Self-hosted operators need to tune for their own Redis/Postgres/worker capacity |
| MCP tools | Exposed (create, find-by-id, find-by-criteria, delete) | Omit like `knowledge-bases` | Nothing here is credential/session material — ingesting and querying documents is exactly the AI-callable case `AGENTS.md`'s MCP rule is for |

## Data Flow

```
Create:
REST/GraphQL/MCP ──(KnowledgeBaseApiKeyGuard)──> CreateDocumentCommand
     │
CommandBus ──> Handler ──> Builder ──> Aggregate.create() [status=PENDING]
     │                 ──> WriteRepo.save() (tenant-scoped)
     │                 ──> DocumentProcessingQueuePort.enqueueChunking(documentId, knowledgeBaseId)
     └──> returns { id, status: PENDING }

Async (BullMQ worker, no HTTP request):
ChunkDocumentProcessor.process(job: { documentId, knowledgeBaseId })
     │
knowledgeBaseContext.run(knowledgeBaseId, async () => {
     ├─ DocumentWriteRepo.findById(documentId)          # tenant-scoped
     ├─ document.startChunking()  [status=CHUNKING]      # domain event
     ├─ ChunkingStrategyPort.chunk(document.content)     # pure, no I/O
     │     ├─ over DOCUMENTS_MAX_CHUNKS? → document.failChunking(reason)
     ├─ ChunkWriteRepo.saveMany(chunks)                  # tenant-scoped
     └─ document.completeChunking(chunkCount) [status=CHUNKED]
})

KnowledgeBase deletion cascade:
KnowledgeBaseDeletedEvent (published by knowledge-bases)
     │
KnowledgeBaseDeletedListener (documents/infrastructure/adapters/)
     └─> DeleteDocumentsByKnowledgeBaseIdCommand ──> deletes all documents + chunks for that tenant
```

## File Changes

All new files under `src/contexts/documents/` (≈90 files — larger than
`knowledge-bases` due to the second aggregate, the async pipeline, and MCP
tools). Key additions beyond the now-familiar aggregate/builder/VO/repo/
transport skeleton:

```
domain/
  aggregates/document.aggregate.ts        — create/update/delete/startChunking/completeChunking/failChunking
  aggregates/chunk.aggregate.ts            — hydration-only; created via builder by the processor
  enums/document-status.enum.ts            — PENDING | CHUNKING | CHUNKED | FAILED
  value-objects/document-content/…         — StringValueObject, max DOCUMENTS_MAX_CONTENT_LENGTH (validated in the handler, not the VO — see Open Questions)
application/
  ports/chunking-strategy.port.ts          — chunk(content: string): { text: string; position: number }[]
  ports/document-processing-queue.port.ts  — enqueueChunking(documentId, knowledgeBaseId): Promise<void>
infrastructure/
  services/recursive-chunking.service.ts   — default ChunkingStrategyPort implementation
  services/bullmq-document-processing-queue.service.ts  — implements the port via @InjectQueue('documents')
  processors/chunk-document.processor.ts   — WorkerHost, opens its own KnowledgeBaseContext frame
  adapters/knowledge-base-deleted.listener.ts  — @EventsHandler(KnowledgeBaseDeletedEvent) from @contexts/knowledge-bases/
transport/
  mcp/tools/document-create.tool.ts, document-find-by-id.tool.ts, document-find-by-criteria.tool.ts, document-delete.tool.ts
```

Modified files:

| File | Action | Description |
|------|--------|-------------|
| `src/database/migrations/1780000000002-CreateDocuments.ts` | Create | `documents` + `chunks` tables |
| `src/contexts/contexts.module.ts` | Modify | Add `DocumentsModule` |
| `.env.example` | Modify | `DOCUMENTS_MAX_CONTENT_LENGTH`, `DOCUMENTS_MAX_CHUNKS` |

## Interfaces / Contracts

```ts
// domain/enums/document-status.enum.ts
export enum DocumentStatusEnum {
  PENDING = 'PENDING',
  CHUNKING = 'CHUNKING',
  CHUNKED = 'CHUNKED',
  FAILED = 'FAILED',
}

// application/ports/chunking-strategy.port.ts
export const CHUNKING_STRATEGY_PORT = Symbol('CHUNKING_STRATEGY_PORT');
export interface IChunk { text: string; position: number }
export interface IChunkingStrategyPort {
  chunk(content: string): IChunk[];
}

// application/ports/document-processing-queue.port.ts
export const DOCUMENT_PROCESSING_QUEUE_PORT = Symbol('DOCUMENT_PROCESSING_QUEUE_PORT');
export interface IDocumentProcessingQueuePort {
  enqueueChunking(documentId: string, knowledgeBaseId: string): Promise<void>;
}

// domain/repositories/write/chunk-write.repository.ts
export interface IChunkWriteRepository {
  saveMany(chunks: ChunkAggregate[]): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
  findByDocumentId(documentId: string): Promise<ChunkAggregate[]>;
}
```

## Database Schema

Table: `documents`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | No | PK |
| knowledge_base_id | UUID | No | Tenant; injected by tenant repo |
| title | varchar(255) | No | |
| content | text | No | Max `DOCUMENTS_MAX_CONTENT_LENGTH`, enforced in the command handler |
| status | varchar(16) | No | `PENDING`\|`CHUNKING`\|`CHUNKED`\|`FAILED` |
| failure_reason | text | Yes | Set when `status = FAILED` |
| chunk_count | int | No | Default 0; set on `CHUNKED` |
| created_at | TIMESTAMPTZ | No | |
| updated_at | TIMESTAMPTZ | No | |

Table: `chunks`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | No | PK |
| document_id | UUID | No | FK-like (no DB constraint, consistent with the codebase's existing cross-aggregate reference pattern) |
| knowledge_base_id | UUID | No | Tenant; injected by tenant repo — duplicated from the parent document so chunk queries don't need a join to enforce isolation |
| position | int | No | Order within the document |
| text | text | No | |
| created_at | TIMESTAMPTZ | No | |

Indexes: `IDX_documents_knowledge_base_id`, `IDX_chunks_knowledge_base_id`,
`IDX_chunks_document_id_position` (document_id, position) — chunk retrieval
order.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Aggregate state machine (`PENDING→CHUNKING→CHUNKED`/`FAILED`, invalid transitions rejected), `RecursiveChunkingService` (paragraph splitting, overlap, guardrail rejection), command handlers, `ChunkDocumentProcessor` (mocked queue job, asserts `knowledgeBaseContext.run` is used) | Jest, `jest.Mocked<T>` |
| Integration | Tenant isolation on both `documents` and `chunks` tables; `KnowledgeBaseDeletedListener` cascade deletes | Real Postgres |
| E2E | REST + GraphQL create → poll status → chunked; guardrail rejection (413/422); MCP tool smoke test | supertest |

## Migration / Rollout

Single additive migration; `down()` drops `chunks` then `documents`. No
backfill. Requires `docker-compose up` (or equivalent) to include the new
`redis` service for local dev — documented in the main README.

## Open Questions

- [ ] Should `DOCUMENTS_MAX_CONTENT_LENGTH` be enforced as a domain VO
      invariant instead of a handler-level check? Recommendation: handler
      level — the limit is an operational/deployment guardrail (tunable
      per self-hosted install via env var), not a domain rule; VOs
      shouldn't read `process.env`.
- [ ] Retry policy for a failed chunking job (BullMQ supports automatic
      retries with backoff) — how many attempts before giving up and
      marking `FAILED`? Recommendation: 3 attempts, exponential backoff
      starting at 5s, matching BullMQ's defaults-adjacent common practice;
      revisit with real failure data post-launch.
