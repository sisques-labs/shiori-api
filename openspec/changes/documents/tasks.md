# Tasks: Document bounded context

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 3 500 – 4 500 |
| 400-line budget risk | High |
| Suggested split | PR 1 → Domain + Application (both aggregates) · PR 2 → Infrastructure (persistence + BullMQ processor + KB-deleted listener) + migration · PR 3 → Transport (REST + GraphQL + MCP) + module wiring · PR 4 → Tests |
| Delivery strategy | ask-on-risk |

---

## Phase 1: Domain — Document

- [ ] 1.1 `domain/enums/document-status.enum.ts` — `PENDING`, `CHUNKING`, `CHUNKED`, `FAILED`
- [ ] 1.2 `domain/value-objects/document-id/document-id.value-object.ts` — extends `UuidValueObject`
- [ ] 1.3 `domain/value-objects/document-title/document-title.value-object.ts` — extends `StringValueObject`, 1–255 chars
- [ ] 1.4 `domain/value-objects/document-content/document-content.value-object.ts` — extends `StringValueObject`, non-empty (max length enforced in the command handler against `DOCUMENTS_MAX_CONTENT_LENGTH`, not here — see design.md Open Questions)
- [ ] 1.5 `domain/value-objects/document-status/document-status.value-object.ts` — extends `EnumValueObject<typeof DocumentStatusEnum>`
- [ ] 1.6 `domain/value-objects/document-failure-reason/document-failure-reason.value-object.ts` — extends `StringValueObject`, non-empty when set
- [ ] 1.7 `domain/events/interfaces/document-event-data.interface.ts` — `{ id, knowledgeBaseId, status }`
- [ ] 1.8 `domain/events/document-created/document-created.event.ts`
- [ ] 1.9 `domain/events/document-updated/document-updated.event.ts`
- [ ] 1.10 `domain/events/document-deleted/document-deleted.event.ts`
- [ ] 1.11 `domain/events/document-chunking-started/document-chunking-started.event.ts`
- [ ] 1.12 `domain/events/document-chunked/document-chunked.event.ts` — future `retrieval` integration point
- [ ] 1.13 `domain/events/document-chunking-failed/document-chunking-failed.event.ts`
- [ ] 1.14 `domain/exceptions/document-not-found.exception.ts` (404), `document-invalid-status-transition.exception.ts` (422), `document-content-too-large.exception.ts` (413), `document-too-many-chunks.exception.ts` (422)
- [ ] 1.15 `domain/interfaces/document.interface.ts` — all fields as VOs
- [ ] 1.16 `domain/primitives/document.primitives.ts` — extends `BasePrimitives`
- [ ] 1.17 `domain/view-models/document.view-model.ts`
- [ ] 1.18 `domain/repositories/write/document-write.repository.ts` — `IDocumentWriteRepository extends IBaseWriteRepository<DocumentAggregate>` + token
- [ ] 1.19 `domain/repositories/read/document-read.repository.ts` — `IDocumentReadRepository extends IBaseReadRepository<DocumentViewModel>` + token
- [ ] 1.20 `domain/aggregates/document.aggregate.ts` — `create()` [PENDING]; `update(content?, title?)` — only when `status` is `CHUNKED`/`FAILED` (not mid-chunking), re-triggers `PENDING`; `delete()`; `startChunking()` [PENDING→CHUNKING, else throws `DocumentInvalidStatusTransitionException`]; `completeChunking(chunkCount)` [CHUNKING→CHUNKED]; `failChunking(reason)` [CHUNKING→FAILED]
- [ ] 1.21 `domain/builders/document.builder.ts` — extends `BaseBuilder`; `withKnowledgeBaseId`, `withTitle`, `withContent`, `withStatus`, `withFailureReason`, `withChunkCount`

## Phase 2: Domain — Chunk

- [ ] 2.1 `domain/value-objects/chunk-id/chunk-id.value-object.ts`
- [ ] 2.2 `domain/value-objects/chunk-text/chunk-text.value-object.ts` — non-empty
- [ ] 2.3 `domain/value-objects/chunk-position/chunk-position.value-object.ts` — extends `NumberValueObject`, >= 0
- [ ] 2.4 `domain/interfaces/chunk.interface.ts`
- [ ] 2.5 `domain/primitives/chunk.primitives.ts`
- [ ] 2.6 `domain/view-models/chunk.view-model.ts`
- [ ] 2.7 `domain/repositories/write/chunk-write.repository.ts` — `IChunkWriteRepository { saveMany(chunks): Promise<void>; deleteByDocumentId(id): Promise<void>; findByDocumentId(id): Promise<ChunkAggregate[]> }` + token. Not `IBaseWriteRepository` — chunks have no single-entity CRUD surface, only batch/by-document operations
- [ ] 2.8 `domain/aggregates/chunk.aggregate.ts` — constructor = hydration only; no domain events (pure derived data, never independently created/updated/deleted from a transport entry point)
- [ ] 2.9 `domain/builders/chunk.builder.ts` — `withDocumentId`, `withKnowledgeBaseId`, `withPosition`, `withText`

## Phase 3: Application

- [ ] 3.1 `application/ports/chunking-strategy.port.ts` — `IChunk { text; position }`, `IChunkingStrategyPort { chunk(content: string): IChunk[] }` + token
- [ ] 3.2 `application/ports/document-processing-queue.port.ts` — `IDocumentProcessingQueuePort { enqueueChunking(documentId, knowledgeBaseId): Promise<void> }` + token
- [ ] 3.3 `application/services/write/assert-document-exists/assert-document-exists.service.ts`
- [ ] 3.4 `application/services/read/assert-document-view-model-exists/assert-document-view-model-exists.service.ts`
- [ ] 3.5 `application/commands/create-document/create-document.command.ts` + `.handler.ts` — builds `PENDING` document, saves, enqueues chunking job, logs completion, returns `{ id, status }`
- [ ] 3.6 `application/commands/update-document/update-document.command.ts` + `.handler.ts` — rejects update while `status = CHUNKING` (`DocumentInvalidStatusTransitionException`); otherwise replaces content/title, deletes existing chunks (`ChunkWriteRepo.deleteByDocumentId`), resets to `PENDING`, re-enqueues
- [ ] 3.7 `application/commands/delete-document/delete-document.command.ts` + `.handler.ts` — deletes chunks then the document
- [ ] 3.8 `application/queries/document-find-by-id/document-find-by-id.query.ts` + `.handler.ts`
- [ ] 3.9 `application/queries/document-find-by-criteria/document-find-by-criteria.query.ts` + `.handler.ts` — standard Criteria pattern (see Phase 6 for the transport-side pieces)

## Phase 4: Infrastructure — Persistence

- [ ] 4.1 `infrastructure/persistence/typeorm/entities/document.entity.ts` — `documents` table
- [ ] 4.2 `infrastructure/persistence/typeorm/entities/chunk.entity.ts` — `chunks` table
- [ ] 4.3 `infrastructure/persistence/typeorm/mappers/document-typeorm.mapper.ts`
- [ ] 4.4 `infrastructure/persistence/typeorm/mappers/chunk-typeorm.mapper.ts`
- [ ] 4.5 `infrastructure/persistence/typeorm/repositories/document-typeorm-write.repository.ts` — `createTenantRepository` wrapped (first real consumer)
- [ ] 4.6 `infrastructure/persistence/typeorm/repositories/document-typeorm-read.repository.ts` — `createTenantRepository` wrapped; `findByCriteria` implemented for real via `applyCriteriaToQueryBuilder` (mandatory pattern, not omitted here — see design.md)
- [ ] 4.7 `infrastructure/persistence/typeorm/repositories/chunk-typeorm-write.repository.ts` — `createTenantRepository` wrapped; `saveMany`, `deleteByDocumentId`, `findByDocumentId`
- [ ] 4.8 `src/database/migrations/1780000000002-CreateDocuments.ts` — `documents` + `chunks` tables, indexes, `down()` drops `chunks` then `documents`

## Phase 5: Infrastructure — Chunking & Queue

- [ ] 5.1 `infrastructure/services/recursive-chunking.service.ts` — implements `IChunkingStrategyPort`; splits on `\n\n`, falls back to `\n`, then sentence boundaries; merges/splits toward ~1000 char target with ~150 char overlap; throws `DocumentTooManyChunksException` if result exceeds `DOCUMENTS_MAX_CHUNKS`
- [ ] 5.2 `infrastructure/config/documents.config.ts` — `registerAs('documents', ...)`: `maxContentLength` (`DOCUMENTS_MAX_CONTENT_LENGTH`, default 500000), `maxChunks` (`DOCUMENTS_MAX_CHUNKS`, default 2000)
- [ ] 5.3 `infrastructure/services/bullmq-document-processing-queue.service.ts` — implements `IDocumentProcessingQueuePort`; `@InjectQueue('documents') queue: Queue`; `enqueueChunking()` calls `queue.add('chunk-document', { documentId, knowledgeBaseId })`
- [ ] 5.4 `infrastructure/processors/chunk-document.processor.ts` — `@Processor('documents') extends WorkerHost`; `process(job)` wraps body in `knowledgeBaseContext.run(job.data.knowledgeBaseId, async () => {...})`; loads document via write repo, calls `aggregate.startChunking()`, saves; runs `ChunkingStrategyPort.chunk()`; on success builds `ChunkAggregate[]` via builder, `ChunkWriteRepo.saveMany()`, `aggregate.completeChunking(count)`, saves; on any thrown error, `aggregate.failChunking(message)`, saves — never lets the job silently disappear without updating document status
- [ ] 5.5 `infrastructure/adapters/knowledge-base-deleted.listener.ts` — `@EventsHandler(KnowledgeBaseDeletedEvent)` (imported from `@contexts/knowledge-bases/domain/events/knowledge-base-deleted/knowledge-base-deleted.event`); dispatches a command that deletes all documents+chunks for `event.data.id` (the knowledge base id)
- [ ] 5.6 `application/commands/delete-documents-by-knowledge-base/delete-documents-by-knowledge-base.command.ts` + `.handler.ts` — internal-only (no transport surface), used by the listener; bypasses per-document `createTenantRepository` scoping concerns by explicitly running within `knowledgeBaseContext.run(knowledgeBaseId, ...)` itself (same reasoning as the processor — this handler fires from an event, not a guarded request)

## Phase 6: Transport — REST + GraphQL Criteria Pattern

- [ ] 6.1 `transport/graphql/enums/document-queryable-field.enum.ts` — `DocumentQueryableField` (id, knowledgeBaseId, title, status, createdAt, updatedAt); registered in `transport/graphql/enums/documents-registered-enums.graphql.ts`
- [ ] 6.2 `transport/graphql/registries/document-filterable-fields.registry.ts` — `documentFilterableFields: FilterFieldRegistry<DocumentQueryableField>`; `status` uses `{ type: 'enum', enum: DocumentStatusEnum }`; co-located `.spec.ts`
- [ ] 6.3 `transport/graphql/dtos/requests/document-filter.input.ts` / `document-sort.input.ts` — `createFilterInput`/`createSortInput` factories
- [ ] 6.4 `transport/rest/dtos/document-find-by-criteria.request.dto.ts` (or GraphQL request dto per pattern) overriding `filters`/`sorts` to the typed inputs
- [ ] 6.5 `transport/rest/dtos/create-document.dto.ts`, `update-document.dto.ts`, `document-rest-response.dto.ts`
- [ ] 6.6 `transport/rest/mappers/document/document.mapper.ts`
- [ ] 6.7 `transport/rest/controllers/documents.controller.ts` — `POST /documents`, `GET /documents/:id`, `GET /documents` (criteria), `PATCH /documents/:id`, `DELETE /documents/:id`; all `@UseGuards(KnowledgeBaseApiKeyGuard)` from `@core/tenancy/`; id/tenant resolution via `@CurrentKnowledgeBaseId()`; log at entry of every method
- [ ] 6.8 `transport/graphql/dtos/requests/create-document-graphql.dto.ts`, `update-document-graphql.dto.ts`
- [ ] 6.9 `transport/graphql/dtos/responses/document.response.dto.ts` (+ `PaginatedDocumentResultDto`)
- [ ] 6.10 `transport/graphql/mappers/document/document.mapper.ts`
- [ ] 6.11 `transport/graphql/resolvers/document-mutations.resolver.ts` — create/update/delete, `@UseGuards(KnowledgeBaseApiKeyGuard)`
- [ ] 6.12 `transport/graphql/resolvers/document-queries.resolver.ts` — findById/findByCriteria, guarded
- [ ] 6.13 `transport/exceptions/documents-exception.filter.ts` — `resolveDocumentsExceptionStatus`; register in `src/core/filters/base-exception.filter.ts`'s `EXCEPTION_STATUS_RESOLVERS`

## Phase 7: Transport — MCP

- [ ] 7.1 `transport/mcp/schemas/document-create.schema.ts`, `document-find-by-id.schema.ts`, `document-find-by-criteria.schema.ts`, `document-delete.schema.ts` — Zod input schemas
- [ ] 7.2 `transport/mcp/tools/document-create.tool.ts` — `DocumentCreateMcpTool implements IMcpTool`, `@McpTool()` + `@Injectable()`, wire name `document_create`, dispatches via `CommandBus`, reads `knowledgeBaseId` from `IMcpToolContext`
- [ ] 7.3 `transport/mcp/tools/document-find-by-id.tool.ts` — `document_find_by_id`
- [ ] 7.4 `transport/mcp/tools/document-find-by-criteria.tool.ts` — `document_find_by_criteria`
- [ ] 7.5 `transport/mcp/tools/document-delete.tool.ts` — `document_delete`

## Phase 8: Module Wiring

- [ ] 8.1 `documents.module.ts` — named provider arrays (`COMMAND_HANDLERS`, `QUERY_HANDLERS`, `APPLICATION_SERVICES`, `DOMAIN_BUILDERS`, `INFRASTRUCTURE_REPOSITORIES`, `INFRASTRUCTURE_MAPPERS`, `INFRASTRUCTURE_ENTITIES`, `TRANSPORT_PROVIDERS`, `MCP_TOOLS`); imports `TenancyModule`, `CqrsModule`, `TypeOrmModule.forFeature([DocumentTypeOrmEntity, ChunkTypeOrmEntity])`, `BullModule.registerQueue({ name: 'documents' })`; registers `ChunkDocumentProcessor` as a provider (BullMQ discovers `@Processor()` classes via DI, not a separate array)
- [ ] 8.2 Modify `src/contexts/contexts.module.ts` — add `DocumentsModule`
- [ ] 8.3 Modify `.env.example` — document `DOCUMENTS_MAX_CONTENT_LENGTH`, `DOCUMENTS_MAX_CHUNKS`, and the already-added `REDIS_*` vars if not already present

## Phase 9: Context README

- [ ] 9.1 `src/contexts/documents/README.md` — aggregate fields, status state machine diagram, chunking pipeline (including the "processor opens its own tenancy frame" detail — the one place in this context that deviates from "the interceptor handles it"), the `KnowledgeBaseDeleted` cascade, guardrail env vars

## Phase 10: Tests

- [ ] 10.1 Unit — `document.aggregate.spec.ts`: valid transitions (`create`→`startChunking`→`completeChunking`, `create`→`startChunking`→`failChunking`); invalid transitions throw (`completeChunking` from `PENDING`, `startChunking` from `CHUNKING`); `update()` rejected while `CHUNKING`
- [ ] 10.2 Unit — `chunk.aggregate.spec.ts`: hydration only, no events
- [ ] 10.3 Unit — `recursive-chunking.service.spec.ts`: paragraph splitting produces expected chunk count/positions; overlap present between adjacent chunks; single-paragraph long text falls back to sentence/char splitting; exceeding `DOCUMENTS_MAX_CHUNKS` throws
- [ ] 10.4 Unit — `create-document.handler.spec.ts` / `update-document.handler.spec.ts` / `delete-document.handler.spec.ts`: happy paths, guardrail rejection (content too large), status-transition rejection on update
- [ ] 10.5 Unit — `chunk-document.processor.spec.ts`: success path (status ends `CHUNKED`, chunks saved); chunking-strategy throw → status ends `FAILED` with the error message, chunks NOT partially saved; asserts `knowledgeBaseContext.run` is invoked with the job's `knowledgeBaseId`
- [ ] 10.6 Unit — `bullmq-document-processing-queue.service.spec.ts`: `enqueueChunking` calls `queue.add` with the right job name/payload
- [ ] 10.7 Unit — `knowledge-base-deleted.listener.spec.ts`: dispatches the delete-by-knowledge-base command with the event's knowledge base id
- [ ] 10.8 Unit — `document-filterable-fields.registry.spec.ts`: every enum value has a registry entry; whitelist rejection
- [ ] 10.9 Integration — tenant isolation on `documents` and `chunks`; `DocumentTypeOrmReadRepository.findByCriteria` with real filters/sort/pagination; `ChunkTypeOrmWriteRepository.saveMany`/`findByDocumentId`/`deleteByDocumentId`
- [ ] 10.10 Integration — `KnowledgeBaseDeletedListener` end-to-end: create KB + document, delete KB, assert document/chunks gone (requires a real BullMQ+Redis connection or a mocked queue — use a mocked `IDocumentProcessingQueuePort` to keep this DB-only)
- [ ] 10.11 E2E — REST: create (202/201 + `PENDING`) → guardrail 413 on oversized content → list via criteria → delete cascades chunks. Chunking completion itself is NOT asserted in E2E (would require a running worker + Redis in CI beyond the Postgres service container already used) — covered by the processor unit test instead
- [ ] 10.12 E2E — GraphQL: create mutation, findByCriteria query with filters
