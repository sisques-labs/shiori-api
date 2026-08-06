# Tasks: Retrieval bounded context

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2 500 – 3 500 |
| 400-line budget risk | High |
| Suggested split | PR 1 → Domain + Application + Infra (persistence, pgvector, embedding pipeline) · PR 2 → Transport (REST + GraphQL + MCP) + module wiring · PR 3 → Tests |
| Delivery strategy | ask-on-risk |

---

## Phase 1: Infrastructure prerequisites (pgvector)

- [ ] 1.1 `docker-compose.yml`, `docker-compose.test.yml` — Postgres image → `pgvector/pgvector:pg18`
- [ ] 1.2 `.github/workflows/ci.yml` — e2e/integration Postgres service image → `pgvector/pgvector:pg18`
- [ ] 1.3 `src/database/migrations/1780000000003-CreateEmbeddings.ts` — `CREATE EXTENSION IF NOT EXISTS "vector"`, `embeddings` table (see design.md schema), HNSW cosine index; `down()` drops index, table, then the extension

## Phase 2: Domain — Embedding

- [ ] 2.1 `domain/value-objects/embedding-id/embedding-id.value-object.ts` — extends `UuidValueObject`
- [ ] 2.2 `domain/interfaces/embedding.interface.ts`
- [ ] 2.3 `domain/primitives/embedding.primitives.ts`
- [ ] 2.4 `domain/repositories/write/embedding-write.repository.ts` — `IEmbeddingWriteRepository { saveMany(embeddings): Promise<void>; deleteByDocumentId(id): Promise<void>; deleteByKnowledgeBaseId(id): Promise<void> }` + token. Not `IBaseWriteRepository` — same reasoning as `IChunkWriteRepository`
- [ ] 2.5 `domain/repositories/read/embedding-read.repository.ts` — `IEmbeddingReadRepository { search(vector, topK): Promise<IRetrievalSearchResult[]> }` + token
- [ ] 2.6 `domain/aggregates/embedding.aggregate.ts` — hydration-only, mirrors `ChunkAggregate`; fields `id, knowledgeBaseId, documentId, chunkId, chunkText, chunkPosition, embedding (number[]), model, createdAt`
- [ ] 2.7 `domain/builders/embedding.builder.ts` — plain class, mirrors `ChunkBuilder`

## Phase 3: Application

- [ ] 3.1 `application/ports/embedding.port.ts` — `IEmbeddingPort { embed(text): Promise<number[]>; embedBatch(texts): Promise<number[][]> }` + token
- [ ] 3.2 `application/ports/chunk-source.port.ts` — `IChunkSourcePort { findByDocumentId(documentId): Promise<IChunkSourceItem[]> }` + token
- [ ] 3.3 `application/ports/embedding-processing-queue.port.ts` — `IEmbeddingProcessingQueuePort { enqueueEmbedding(documentId, knowledgeBaseId): Promise<void> }` + token
- [ ] 3.4 `application/commands/embed-document-chunks/` — internal only; fetches chunks via `ChunkSourcePort`, embeds via `EmbeddingPort.embedBatch`, saves via `EmbeddingWriteRepository.saveMany`
- [ ] 3.5 `application/commands/delete-embeddings-by-document/` — internal only
- [ ] 3.6 `application/commands/delete-embeddings-by-knowledge-base/` — internal only
- [ ] 3.7 `application/queries/retrieval-search/retrieval-search.query.ts` + `.handler.ts` — public; `{ query: string, topK?: number }`, clamps `topK` to `RETRIEVAL_SEARCH_TOP_K_MAX`, defaults to `RETRIEVAL_SEARCH_TOP_K_DEFAULT`; embeds the query text, delegates to `EmbeddingReadRepository.search`

## Phase 4: Infrastructure — Persistence

- [ ] 4.1 `infrastructure/persistence/typeorm/entities/embedding.entity.ts` — `embeddings` table; `@Column({ type: 'vector', length: 1536 }) embedding: number[]`
- [ ] 4.2 `infrastructure/persistence/typeorm/mappers/embedding-typeorm.mapper.ts`
- [ ] 4.3 `infrastructure/persistence/typeorm/repositories/embedding-typeorm-write.repository.ts` — `createTenantRepository` wrapped; `saveMany` bulk-inserts via the raw repository (same reasoning as `ChunkTypeOrmWriteRepository.saveMany` — the tenant-repo proxy's `save` interceptor only handles single entities), stamping `knowledgeBaseId` explicitly
- [ ] 4.4 `infrastructure/persistence/typeorm/repositories/embedding-typeorm-read.repository.ts` — `search()` builds the raw `ORDER BY embedding <=> :queryVector` fragment (own `toPgVectorLiteral(vector): string` helper, bound as a parameter — never string-interpolated), scoped by `knowledge_base_id = :knowledgeBaseId` from `KnowledgeBaseContext`, `LIMIT :topK`; returns `1 - distance` as `score`

## Phase 5: Infrastructure — Embedding pipeline & cross-context adapters

- [ ] 5.1 `infrastructure/services/openai-compatible-embedding.service.ts` — implements `IEmbeddingPort`; calls `POST {RETRIEVAL_EMBEDDING_BASE_URL}/embeddings` with `{ input, model: RETRIEVAL_EMBEDDING_MODEL }`, `Authorization: Bearer {RETRIEVAL_EMBEDDING_API_KEY}`; `embed()` delegates to `embedBatch([text])[0]`
- [ ] 5.2 `infrastructure/config/retrieval.config.ts` — `registerAs('retrieval', ...)`: `embeddingBaseUrl`, `embeddingApiKey`, `embeddingModel`, `searchTopKDefault` (`RETRIEVAL_SEARCH_TOP_K_DEFAULT`, default 5), `searchTopKMax` (`RETRIEVAL_SEARCH_TOP_K_MAX`, default 20)
- [ ] 5.3 `infrastructure/services/bullmq-embedding-processing-queue.service.ts` — implements `IEmbeddingProcessingQueuePort`; `@InjectQueue('retrieval') queue: Queue`
- [ ] 5.4 `infrastructure/processors/embed-document-chunks.processor.ts` — `@Processor('retrieval') extends WorkerHost`; opens `knowledgeBaseContext.run(job.data.knowledgeBaseId, ...)`; `ChunkSourcePort.findByDocumentId` → `EmbeddingPort.embedBatch` → build `EmbeddingAggregate[]` via builder → `EmbeddingWriteRepo.saveMany`
- [ ] 5.5 `infrastructure/adapters/document-chunk-source.adapter.ts` — implements `ChunkSourcePort`, dispatches `documents`' internal `ChunkFindByDocumentIdQuery` via the global `QueryBus` and maps the result to `IChunkSourceItem[]`
- [ ] 5.6 `infrastructure/adapters/document-chunked.listener.ts` — `@EventsHandler(DocumentChunkedEvent)` from `@contexts/documents/domain/events/document-chunked/document-chunked.event`; dispatches `EmbeddingProcessingQueuePort.enqueueEmbedding` (not a command — this one enqueues, matching the async-embedding decision)
- [ ] 5.7 `infrastructure/adapters/document-chunking-started.listener.ts` — `@EventsHandler(DocumentChunkingStartedEvent)`; dispatches `DeleteEmbeddingsByDocumentCommand` synchronously (fast DB-only delete, no queue — clears stale embeddings before the new chunking run completes)
- [ ] 5.8 `infrastructure/adapters/document-deleted.listener.ts` — `@EventsHandler(DocumentDeletedEvent)` from `@contexts/documents/`; dispatches `DeleteEmbeddingsByDocumentCommand`
- [ ] 5.9 `infrastructure/adapters/knowledge-base-deleted.listener.ts` — `@EventsHandler(KnowledgeBaseDeletedEvent)` from `@contexts/knowledge-bases/`; dispatches `DeleteEmbeddingsByKnowledgeBaseCommand`
- [ ] 5.10 Add `documents/application/queries/chunk-find-by-document-id/` (query + handler, internal only) and register the handler in `src/contexts/documents/documents.module.ts`

## Phase 6: Transport — REST + GraphQL

- [ ] 6.1 `transport/rest/dtos/retrieval-search.dto.ts` — `{ query: string (1-2000 chars), topK?: number }`
- [ ] 6.2 `transport/rest/dtos/retrieval-search-result-rest-response.dto.ts`
- [ ] 6.3 `transport/rest/mappers/retrieval/retrieval.mapper.ts`
- [ ] 6.4 `transport/rest/controllers/retrieval.controller.ts` — `POST /retrieval/search` only, `@UseGuards(KnowledgeBaseApiKeyGuard)`, log at entry
- [ ] 6.5 `transport/graphql/dtos/requests/retrieval-search-graphql.dto.ts`
- [ ] 6.6 `transport/graphql/dtos/responses/retrieval-search-result.response.dto.ts`
- [ ] 6.7 `transport/graphql/mappers/retrieval/retrieval.mapper.ts`
- [ ] 6.8 `transport/graphql/resolvers/retrieval-queries.resolver.ts` — `retrievalSearch` query only, guarded
- [ ] 6.9 `transport/exceptions/retrieval-exception.filter.ts` — `resolveRetrievalExceptionStatus`; register in `src/core/filters/base-exception.filter.ts`

## Phase 7: Transport — MCP

- [ ] 7.1 `transport/mcp/schemas/retrieval-search.schema.ts` — Zod input schema (`query`, optional `topK`)
- [ ] 7.2 `transport/mcp/tools/retrieval-search.tool.ts` — `RetrievalSearchMcpTool implements IMcpTool<IMcpToolContext>`, wire name `retrieval_search`, reads `knowledgeBaseId` from context (search is already tenant-scoped by the query handler via ambient `KnowledgeBaseContext`, but the MCP context builder still needs to have resolved a valid tenant to reach this tool at all)

## Phase 8: Module Wiring

- [ ] 8.1 `retrieval.module.ts` — named provider arrays; imports `TenancyModule`, `CqrsModule`, `HttpModule`, `ConfigModule.forFeature(retrievalConfig)`, `TypeOrmModule.forFeature([EmbeddingTypeOrmEntity])`, `BullModule.registerQueue({ name: 'retrieval' })`. No `documents` module import — `DocumentChunkSourceAdapter` only needs the global `QueryBus`
- [ ] 8.2 Modify `src/contexts/contexts.module.ts` — add `RetrievalModule` (after `DocumentsModule` — order matters for provider resolution given the cross-module dependency)
- [ ] 8.3 Modify `.env.example` — document `RETRIEVAL_EMBEDDING_BASE_URL`, `RETRIEVAL_EMBEDDING_API_KEY`, `RETRIEVAL_EMBEDDING_MODEL`, `RETRIEVAL_SEARCH_TOP_K_DEFAULT`, `RETRIEVAL_SEARCH_TOP_K_MAX`

## Phase 9: Context README

- [ ] 9.1 `src/contexts/retrieval/README.md` — aggregate fields, embedding pipeline diagram, the pgvector column/search implementation notes (native TypeORM support, no new dependency, raw `<=>` fragment), the fixed-1536-dimension constraint, cleanup listeners, guardrail env vars

## Phase 10: Tests

- [ ] 10.1 Unit — `embed-document-chunks.handler.spec.ts`: happy path (fetches chunks, embeds batch, saves)
- [ ] 10.2 Unit — `retrieval-search.handler.spec.ts`: embeds query, delegates to read repo, clamps `topK` to `searchTopKMax`, applies `searchTopKDefault` when omitted
- [ ] 10.3 Unit — `embed-document-chunks.processor.spec.ts`: mocked `ChunkSourcePort`/`EmbeddingPort`, asserts `knowledgeBaseContext.run` invoked with the job's `knowledgeBaseId`, asserts `EmbeddingWriteRepo.saveMany` called with the right shape
- [ ] 10.4 Unit — `openai-compatible-embedding.service.spec.ts`: mocked HTTP client, asserts request shape (`input`, `model`, `Authorization` header), asserts response parsing
- [ ] 10.5 Unit — the three cleanup listeners: each dispatches the right internal command with the right id, mirroring `knowledge-base-deleted.listener.spec.ts` in `documents`
- [ ] 10.6 Unit — `document-chunk-source.adapter.spec.ts`: maps `ChunkAggregate[]` to `IChunkSourceItem[]` correctly
- [ ] 10.7 Integration — `EmbeddingTypeOrmReadRepository.search()` against real pgvector: insert known vectors at known distances, assert nearest-neighbor ordering; tenant isolation (two knowledge bases, search never crosses)
- [ ] 10.8 Integration — `EmbeddingTypeOrmWriteRepository.saveMany`/`deleteByDocumentId`/`deleteByKnowledgeBaseId`
- [ ] 10.9 E2E — REST: seed a knowledge base + document + chunks + embeddings directly via repositories (bypassing the real embedding HTTP call), `POST /retrieval/search` returns ranked results scoped to the caller's knowledge base
- [ ] 10.10 E2E — GraphQL: `retrievalSearch` query, same seeding approach
