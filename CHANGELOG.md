# Changelog

All notable changes to this project will be documented in this file.
## [0.1.0] - 2026-08-08

### Bug Fixes
- **docs:** Align .env.example with embeddings config vars (fd876d2)

### Features
- **api:** Add Swagger authentication and URI versioning (2f56310)
## [0.0.3] - 2026-08-07

### Bug Fixes
- **docker:** Mount postgres volume at /var/lib/postgresql for pg18 compatibility (d0385e7)
## [0.0.2] - 2026-08-07

### Bug Fixes
- **knowledge-bases:** Resolve KnowledgeBaseApiKeyGuard DI failure in TenancyModule (f18a0ad)
- **knowledge-bases:** Import TenancyModule explicitly in KnowledgeBasesModule (c8b3438)
- **test:** Use CqrsModule.forRoot() in integration-bootstrap.ts (9cf12de)
- **core:** Regenerate aggregate-module map without the uncommitted retrieval aggregate (863145e)
- **documents:** Update KnowledgeBaseDeletedEvent mock to match IKnowledgeBaseEventData (a3b66ba)
- **documents:** Full event primitives, FK cascades, write findByCriteria, job progress (c6d4a8d)
- **test:** Insert real parent rows in documents/chunks integration fixtures (e1439e2)
- **documents:** Stamp updatedAt when building chunks in the query-handler spec (3427d57)

### Chore
- **tenancy:** Note pending format cleanup for TenancyModule (c860844)
- **docker:** Remove version specification from docker-compose files (c62f3f7)
- **deps:** Update @sisques-labs/nestjs-kit to version 1.6.0 in package.json and pnpm-lock.yaml (f932a42)

### Documentation
- Propose knowledge-bases bounded context (763ea12)
- **documents:** Openspec proposal for the Document bounded context (878d2e1)
- **retrieval:** Add context README (d3d8815)
- **retrieval:** Add context README (95c1d00)

### Features
- **knowledge-bases:** Implement tenant-root bounded context (5b73c0d)
- **core:** Add Redis-backed BullMQ job queue infrastructure (3e94d45)
- **documents:** Add domain layer for Document and Chunk aggregates (b54c86e)
- **documents:** Add application layer (09834a5)
- **documents:** Add TypeORM persistence layer and migration (5cbef8d)
- **documents:** Add chunking pipeline and knowledge-base-deleted cascade (d0b7d15)
- **documents:** Add REST and GraphQL transport layer (aa2b8fa)
- **documents:** Add MCP tools and API-key-based MCP context builder (221514c)
- **documents:** Wire the module into the app and document the context (9ac80a7)
- **retrieval:** Add pgvector infra and Embedding domain layer (ef094bc)
- **retrieval:** Add application layer (384b8fc)
- **retrieval:** Add TypeORM persistence layer with pgvector search (b2df044)
- **retrieval:** Add embedding pipeline and cross-context adapters (be6d9c1)
- **retrieval:** Add REST and GraphQL transport layer (dc37a1e)
- **retrieval:** Add retrieval_search MCP tool (b58991b)
- **retrieval:** Wire the module into the app (d6bcb3f)
- **retrieval:** Add pgvector infra and Embedding domain layer (6b48fa2)
- **retrieval:** Add application layer (9d7dd65)
- **retrieval:** Add TypeORM persistence layer with pgvector search (cbe49f3)
- **retrieval:** Add embedding pipeline and cross-context adapters (5c7b03c)
- **retrieval:** Add REST and GraphQL transport layer (04a7129)
- **retrieval:** Add retrieval_search MCP tool (e2f2c54)
- **retrieval:** Wire the module into the app (1b73779)

### Refactor
- **knowledge-bases:** Move KnowledgeBaseApiKeyGuard to core/tenancy (c60416c)
- **knowledge-bases:** Descriptive variable names + Pick/Omit on Command/Query inputs (0c70ae6)
- **knowledge-bases:** Field-changed events, event data omits apiKeyHash, IBaseService (c729b75)
- **knowledge-bases:** Drop toEventData(), omit apiKeyHash from toPrimitives() inline (8f2b262)
- **knowledge-bases:** Mappers for command results, module format, drop unused type (c187a30)
- **knowledge-bases:** Create handler returns only id+apiKey, matches gardenia's create pattern (3fde3c6)
- **knowledge-bases:** Reach HashApiKeyService via port+adapter, not direct injection (fc7f2c1)
- **tenancy:** Match gardenia's SharedModule format exactly (65daf97)
- **documents:** Pick/Omit command inputs, extract batch-delete to a service (52090aa)
- **documents:** Pick/Omit query input, descriptive variable names (0197faf)
- **documents:** Field-changed events, chunkCount VO, assert services, batch-fetch port (ad6e07c)
- **retrieval:** Split embeddings into their own bounded context (cc2666c)
- **documents:** Extract status-guard conditions to domain services, extend chunk write repo (0c882db)
- **documents:** Constructor-inject the two domain assert services (51e3c18)
- **documents:** Extend BaseAggregate/BasePrimitives/BaseViewModel for Chunk (a3c31bd)
- **retrieval:** Split embeddings into their own bounded context (686b5d5)
- **embeddings:** Extend base builder/repositories, add FK constraints (0401d3e)
- **embeddings:** Extend BaseAggregate/BasePrimitives/BaseViewModel (6accb35)
- **embeddings:** Use nestjs-kit's VectorValueObject (ed6637c)
- **embeddings:** Wrap kit's VectorValueObject in a domain VO, move dimension constant (ba3131f)

### Revert
- **documents:** Drop batch-finder port/adapter, call repository directly (94261ac)
- **documents:** Keep status-guard conditions inline in the aggregate (db4155c)

### Testing
- **documents:** Add DocumentAggregate/ChunkAggregate/RecursiveChunkingService unit tests (8de506d)
- **documents:** Add remaining handler/processor/listener unit tests and integration specs (920cef8)
- **documents:** Add chunk repository integration spec and E2E suites (661049c)
- **retrieval:** Add RetrievalSearchQueryHandler and EmbedDocumentChunksProcessor unit tests (99d5bbd)
- **retrieval:** Add remaining unit/integration/e2e tests (e4bc4a6)
- **retrieval:** Add RetrievalSearchQueryHandler and EmbedDocumentChunksProcessor unit tests (124dcd9)
- **retrieval:** Add remaining unit/integration/e2e tests (49a2403)

