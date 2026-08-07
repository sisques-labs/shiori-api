# Tasks: Flexible embedding vector dimensions per Knowledge Base

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2 000 – 3 000 |
| 400-line budget risk | High |
| Suggested split | PR 1 → `embeddings` registry + table-per-dimension persistence + port signature changes · PR 2 → `knowledge-bases` fields/commands + cross-context wiring · PR 3 → re-embed pipeline (processor, listener, `documents` new query) · PR 4 → transport (new query, new command endpoints) + tests |
| Delivery strategy | ask-on-risk |

---

## Phase 1: `embeddings` — Model registry

- [ ] 1.1 `domain/constants/embedding-models-registry.constant.ts` — `EmbeddingModelDefinition` interface + `EMBEDDING_MODELS_REGISTRY` array; delete `domain/constants/embedding-vector-dimensions.constant.ts`
- [ ] 1.2 `domain/services/embedding-model-registry.service.ts` — `findById`, `getOrThrow`, `listAll`
- [ ] 1.3 `domain/exceptions/unknown-embedding-model.exception.ts`
- [ ] 1.4 `domain/exceptions/no-embedding-table-for-dimension.exception.ts`

## Phase 2: `embeddings` — Table-per-dimension persistence

- [ ] 2.1 `infrastructure/persistence/typeorm/entities/embedding.entity.ts` — convert to an abstract base (drop the fixed `embedding` column)
- [ ] 2.2 `infrastructure/persistence/typeorm/entities/embedding-entity.factory.ts` — `createEmbeddingTypeOrmEntity(dimensions)`; `EMBEDDING_DIMENSIONS`, `EMBEDDING_ENTITIES_BY_DIMENSION` constants derived from the registry
- [ ] 2.3 `domain/value-objects/embedding-vector/embedding-vector.value-object.ts` — accept `dimensions` per-instance instead of the deleted global constant
- [ ] 2.4 `domain/repositories/write/embedding-write.repository.ts` — add `dimensions: number` param to `saveMany`/`deleteByDocumentId`/`deleteByKnowledgeBaseId`
- [ ] 2.5 `domain/repositories/read/embedding-read.repository.ts` — add `dimensions: number` param to `search`
- [ ] 2.6 `infrastructure/persistence/typeorm/repositories/embedding-typeorm-write.repository.ts` — route to the repository matching the given `dimensions` (built from `EMBEDDING_ENTITIES_BY_DIMENSION`); throw `NoEmbeddingTableForDimensionException` on an unregistered dimension
- [ ] 2.7 `infrastructure/persistence/typeorm/repositories/embedding-typeorm-read.repository.ts` — same routing for `search()`
- [ ] 2.8 `infrastructure/persistence/typeorm/mappers/embedding-typeorm.mapper.ts` — adjust for the abstract base entity type

## Phase 3: Database migrations

- [ ] 3.1 New migration — alter `knowledge_bases`: add `embedding_model varchar(100)` (backfill existing rows with `'text-embedding-3-small'`, then `NOT NULL`), add `embedding_status varchar(20) NOT NULL DEFAULT 'READY'`
- [ ] 3.2 New migration — drop `embeddings` table (no production data to preserve); `down()` recreates it exactly as `CreateEmbeddings1780000000003`
- [ ] 3.3 New migration — create `embeddings_768`, `embeddings_1024`, `embeddings_1536`, `embeddings_3072` (one per distinct dimension in the initial registry), each with the FK constraints, `knowledge_base_id`/`document_id` indexes, and HNSW cosine index from design.md's schema; `down()` drops all four

## Phase 4: `embeddings` — `IEmbeddingPort` model parameter

- [ ] 4.1 `application/ports/embedding.port.ts` — `embed(text, model)` / `embedBatch(texts, model)`
- [ ] 4.2 `infrastructure/services/openai-compatible-embedding.service.ts` — use the passed `model`, not a config-injected one
- [ ] 4.3 `infrastructure/config/embeddings.config.ts` — remove `embeddingModel`/`EMBEDDINGS_MODEL`
- [ ] 4.4 `.env.example` — remove `EMBEDDINGS_MODEL`

## Phase 5: `knowledge-bases` — New fields

- [ ] 5.1 `domain/value-objects/knowledge-base-embedding-model/knowledge-base-embedding-model.value-object.ts`
- [ ] 5.2 `domain/enums/knowledge-base-embedding-status.enum.ts`
- [ ] 5.3 `domain/value-objects/knowledge-base-embedding-status/knowledge-base-embedding-status.value-object.ts`
- [ ] 5.4 `domain/interfaces/knowledge-base.interface.ts`, `domain/primitives/knowledge-base.primitives.ts`, `domain/view-models/knowledge-base.view-model.ts` — add both fields
- [ ] 5.5 `domain/aggregates/knowledge-base.aggregate.ts` — add fields, `changeEmbeddingModel()`, `completeReembedding()`, `failReembedding(reason)`
- [ ] 5.6 `domain/events/knowledge-base-embedding-model-change-requested/knowledge-base-embedding-model-change-requested.event.ts`
- [ ] 5.7 `domain/exceptions/invalid-embedding-model.exception.ts`, `domain/exceptions/knowledge-base-reembedding-in-progress.exception.ts`
- [ ] 5.8 `infrastructure/persistence/typeorm/entities/knowledge-base.entity.ts` — `embedding_model`, `embedding_status` columns
- [ ] 5.9 `infrastructure/persistence/typeorm/mappers/knowledge-base-typeorm.mapper.ts` — map both fields
- [ ] 5.10 `domain/builders/knowledge-base.builder.ts` — `withEmbeddingModel`, `withEmbeddingStatus` (default `READY`)

## Phase 6: `knowledge-bases` — Cross-context model validation

- [ ] 6.1 `application/ports/embedding-model-validation.port.ts` — `IEmbeddingModelValidationPort { isValid(modelId): Promise<boolean> }`
- [ ] 6.2 `infrastructure/adapters/embedding-model-validation.adapter.ts` — dispatches `embeddings`' internal `EmbeddingModelExistsQuery` via `QueryBus`

## Phase 7: `knowledge-bases` — Commands

- [ ] 7.1 `application/commands/create-knowledge-base/create-knowledge-base.command.ts` + `.handler.ts` — require `embeddingModel`, validate via the port, default `embeddingStatus = READY`
- [ ] 7.2 `application/commands/change-knowledge-base-embedding-model/change-knowledge-base-embedding-model.command.ts` + `.handler.ts` — validate, no-op-on-same-model, reject-if-`REEMBEDDING`, else `changeEmbeddingModel()` + save + publish
- [ ] 7.3 `application/commands/complete-knowledge-base-reembedding/` — internal only
- [ ] 7.4 `application/commands/fail-knowledge-base-reembedding/` — internal only

## Phase 8: `embeddings` — Cross-context Knowledge Base config

- [ ] 8.1 `application/ports/knowledge-base-embedding-config.port.ts` — `IKnowledgeBaseEmbeddingConfigPort`
- [ ] 8.2 `infrastructure/adapters/knowledge-base-embedding-config.adapter.ts` — dispatches `knowledge-bases`' `KnowledgeBaseFindByIdQuery` via `QueryBus`
- [ ] 8.3 `knowledge-bases/application/queries/knowledge-base-find-by-id/` — extend the returned `KnowledgeBaseViewModel` (already includes new fields per Phase 5.4)

## Phase 9: `embeddings` — Public + internal queries

- [ ] 9.1 `application/queries/embedding-available-models/embedding-available-models.query.ts` + `.handler.ts` — public, returns `EMBEDDING_MODELS_REGISTRY`
- [ ] 9.2 `application/queries/embedding-model-exists/embedding-model-exists.query.ts` + `.handler.ts` — internal, `{ modelId }` → `boolean`
- [ ] 9.3 `application/queries/embedding-search/embedding-search.handler.ts` — resolve `IKnowledgeBaseEmbeddingConfigPort` first; throw `KnowledgeBaseNotReadyForSearchException` if not `READY`; resolve `dimensions`; pass `model`/`dimensions` through to the port/repository calls
- [ ] 9.4 `domain/exceptions/knowledge-base-not-ready-for-search.exception.ts`

## Phase 10: `embeddings` — Re-embed pipeline

- [ ] 10.1 `application/ports/embedding-reembed-queue.port.ts` — `IEmbeddingReembedQueuePort { enqueueReembed(knowledgeBaseId, previousModel, newModel): Promise<void> }`
- [ ] 10.2 `infrastructure/services/bullmq-embedding-reembed-queue.service.ts` — implements it, `@InjectQueue('embeddings')` (existing queue, new job name)
- [ ] 10.3 `infrastructure/adapters/knowledge-base-embedding-model-changed.listener.ts` — `@EventsHandler(KnowledgeBaseEmbeddingModelChangeRequestedEvent)` from `@contexts/knowledge-bases/`; enqueues the reembed job
- [ ] 10.4 `application/ports/chunk-source.port.ts` — add `findKnowledgeBaseDocumentIds(knowledgeBaseId): Promise<string[]>`
- [ ] 10.5 `infrastructure/adapters/document-chunk-source.adapter.ts` — implement the new method via `documents`' new query (Phase 11)
- [ ] 10.6 `infrastructure/processors/reembed-knowledge-base.processor.ts` — `@Processor('embeddings') extends WorkerHost`; opens `knowledgeBaseContext.run`; per design.md §"Re-embedding pipeline" — clears target-dimension rows for this KB first (idempotent retry, per proposal.md Open Questions), embeds every document's chunks under the new model, deletes previous-dimension rows only after all documents succeed, dispatches `CompleteKnowledgeBaseReembeddingCommand`/`FailKnowledgeBaseReembeddingCommand`
- [ ] 10.7 `infrastructure/processors/embed-document-chunks.processor.ts` — resolve `IKnowledgeBaseEmbeddingConfigPort` + registry dimension before embedding, pass `model`/`dimensions` through (Phase 5's `EmbedDocumentChunks` flow, modified per design.md §"Data Flow")

## Phase 11: `documents` — New internal query

- [ ] 11.1 `application/queries/document-find-ids-by-knowledge-base-id/document-find-ids-by-knowledge-base-id.query.ts` + `.handler.ts` — internal only, wraps existing document read repository's `findByCriteria`/a new `findIdsByKnowledgeBaseId` method
- [ ] 11.2 Register the handler in `src/contexts/documents/documents.module.ts`

## Phase 12: `retrieval` — Surface the new 409

- [ ] 12.1 `transport/exceptions/retrieval-exception.filter.ts` (or reuse `embeddings-exception.filter.ts` if the exception is thrown from `embeddings` and propagates) — map `KnowledgeBaseNotReadyForSearchException` → HTTP 409

## Phase 13: Transport — `knowledge-bases`

- [ ] 13.1 `transport/rest/dtos/create-knowledge-base.dto.ts` — add required `embeddingModel`
- [ ] 13.2 `transport/rest/dtos/change-knowledge-base-embedding-model.dto.ts` — `{ embeddingModel: string }`
- [ ] 13.3 `transport/rest/controllers/knowledge-bases.controller.ts` — `PATCH /:id/embedding-model`
- [ ] 13.4 `transport/graphql/dtos/requests/create-knowledge-base-graphql.dto.ts` — add `embeddingModel`
- [ ] 13.5 `transport/graphql/dtos/requests/change-knowledge-base-embedding-model-graphql.dto.ts`
- [ ] 13.6 `transport/graphql/resolvers/knowledge-base-mutations.resolver.ts` — `changeKnowledgeBaseEmbeddingModel` mutation
- [ ] 13.7 `transport/graphql/dtos/responses/knowledge-base.response.dto.ts` — expose `embeddingModel`/`embeddingStatus`
- [ ] 13.8 `transport/exceptions/knowledge-bases-exception.filter.ts` — map the two new exceptions (400 / 409)

## Phase 14: Transport — `embeddings`

- [ ] 14.1 `transport/rest/controllers/embeddings.controller.ts` — `GET /embeddings/models` (new — this context previously had none)
- [ ] 14.2 `transport/rest/dtos/embedding-model-rest-response.dto.ts`
- [ ] 14.3 `transport/graphql/resolvers/embeddings-queries.resolver.ts` — `embeddingModels` query
- [ ] 14.4 `transport/graphql/dtos/responses/embedding-model.response.dto.ts`

## Phase 15: Module wiring

- [ ] 15.1 `embeddings.module.ts` — register all generated entity classes in `TypeOrmModule.forFeature`, new providers (registry service, new ports/adapters, new processor, new queue service, new query/command handlers, new REST controller/GraphQL resolver)
- [ ] 15.2 `knowledge-bases.module.ts` — new providers (value objects don't need DI, but new command handlers, port/adapter, exception filter entries do)

## Phase 16: Context READMEs

- [ ] 16.1 `src/contexts/embeddings/README.md` — rewrite "Fixed embedding dimension" section entirely: registry, table-per-dimension, the new public query, the re-embed pipeline
- [ ] 16.2 `src/contexts/knowledge-bases/README.md` — document `embeddingModel`/`embeddingStatus`, the new command, the state machine (`READY ⇄ REEMBEDDING ⇄ FAILED`)

## Phase 17: Tests

- [ ] 17.1 Unit — `embedding-model-registry.service.spec.ts`: found/unknown/list
- [ ] 17.2 Unit — routing write/read repository specs: resolves the correct underlying repository per `dimensions`, throws on an unregistered one
- [ ] 17.3 Unit — `change-knowledge-base-embedding-model.handler.spec.ts`: happy path, no-op on same model, 409 on already-`REEMBEDDING`, 400 on unknown model
- [ ] 17.4 Unit — `embedding-search.handler.spec.ts`: 409 when status !== READY, passes correct `model`/`dimensions` when READY
- [ ] 17.5 Unit — `reembed-knowledge-base.processor.spec.ts`: happy path across multiple documents, dispatches Complete on success, dispatches Fail + preserves old table on mid-run failure, clears target table before starting (retry safety)
- [ ] 17.6 Unit — `embed-document-chunks.processor.spec.ts` (updated): resolves KB config + dimension before embedding
- [ ] 17.7 Unit — `openai-compatible-embedding.service.spec.ts` (updated): asserts the passed-in `model` is used, not a config default
- [ ] 17.8 Integration — two `embeddings_{dimension}` tables in the same test run; search only touches the table matching the resolved dimension; tenant isolation within a shared-dimension table (SC-06)
- [ ] 17.9 Integration — `knowledge_bases` migration `up`/`down` round-trip, including the backfill default for pre-existing rows
- [ ] 17.10 E2E — `POST /knowledge-bases` requires/validates `embeddingModel`; `PATCH /knowledge-bases/:id/embedding-model` happy path + 409 mid-reembed + 400 unknown model
- [ ] 17.11 E2E — `GET /embeddings/models` returns the registry, unauthenticated
- [ ] 17.12 E2E — search returns 409 while a Knowledge Base is `REEMBEDDING` (embedding port stubbed at the HTTP boundary, as in the existing `retrieval` E2E suite)
