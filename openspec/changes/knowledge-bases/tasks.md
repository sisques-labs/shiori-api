# Tasks: KnowledgeBase bounded context

## Implementation Notes (discovered during apply, not in the original plan)

- `package.json`'s Jest `moduleNameMapper` only mapped `@core/*` — a
  pre-existing template gap (no context existed yet to need `@contexts/*` in
  unit tests). Added the missing mapping; `test/jest-e2e.json` and
  `test/jest-integration.json` already had it correctly.
- Added `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` to the migration's
  `up()` — this is the first migration in the service, and nothing upstream
  guarantees that extension exists on a fresh Postgres.
- Registered the new migration in `test/helpers/test-data-source.ts`
  (`TEST_MIGRATIONS`) and added `knowledge_bases` to `TRUNCATE_TABLES` in
  `test/helpers/db-reset.ts`, per the placeholders those files already had.
- Regenerated `src/core/messaging/domain/topics/aggregate-module.map.generated.ts`
  via `pnpm gen:topics` (mandatory pre-commit step per `AGENTS.md`).
- `findByCriteria` on both repositories deliberately stubbed
  (`throw new Error('Method not implemented.')`) rather than left unwritten —
  matches the existing codebase convention for interface methods with no
  transport surface (see design.md's Architecture Decisions).

**Not run in this environment:** integration and E2E tests require a live
Postgres (`pnpm test:db:up`, Docker) — unavailable in this sandbox. Unit
tests (131/131), lint, and build all pass locally; integration/E2E specs are
written and should be verified in CI or a Docker-enabled environment before
merge.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2 200 – 2 800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → Tenancy core (`src/core/tenancy/`) · PR 2 → Domain + Application · PR 3 → Infrastructure + Migration + Guard · PR 4 → Transport + Module wiring · PR 5 → Tests |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Cross-cutting tenancy mechanism | PR 1 | `KnowledgeBaseContext`, `createTenantRepository`, `KnowledgeBaseContextInterceptor`, `TenancyModule` — no dependency on the context below, land first |
| 2 | Domain + Application layer (no I/O) | PR 2 | Aggregate, VOs, enums-free (no enums in this context), events, exceptions, ports N/A, commands, queries, assert services, key generation/hashing services |
| 3 | Infrastructure layer + migration + guard | PR 3 | TypeORM entity, mapper, write repo, read repo, migration, `KnowledgeBaseApiKeyGuard`, skip decorator |
| 4 | Transport + module wiring | PR 4 | REST controller + DTOs, GraphQL resolvers + types, `KnowledgeBasesModule`, `core.module.ts`, `contexts.module.ts` |
| 5 | Tests (unit + integration + e2e) | PR 5 | All test files; references SC-01 → SC-12 |

---

## Phase 1: Tenancy Core (`src/core/tenancy/`)

- [x] 1.1 Create `src/core/tenancy/knowledge-base-context.service.ts` — `KnowledgeBaseContext` using `AsyncLocalStorage<{ knowledgeBaseId: string }>`; `run<T>(knowledgeBaseId, fn): T`; `get(): string | undefined`; `require(): string` throwing `KnowledgeBaseContextMissingException` when unset
- [x] 1.2 Create `src/core/tenancy/exceptions/knowledge-base-context-missing.exception.ts` — thrown by `.require()`; extends `BaseException` from nestjs-kit; HTTP 500 (programmer error — a guarded route reached a repository without the interceptor having run)
- [x] 1.3 Create `src/core/tenancy/create-tenant-repository.factory.ts` — `createTenantRepository<E extends { knowledgeBaseId: string }>(repo: Repository<E>, ctx: KnowledgeBaseContext): Repository<E>`; `Proxy` intercepting `findOne`/`find`/`findAndCount` (inject `where.knowledgeBaseId = ctx.require()`), `save` (inject `knowledgeBaseId` onto the entity), `delete` (inject into criteria); all other properties pass through via `Reflect.get`
- [x] 1.4 Create `src/core/tenancy/knowledge-base-context.interceptor.ts` — `KnowledgeBaseContextInterceptor implements NestInterceptor`; reads `req.knowledgeBaseId` (works for both HTTP and GraphQL execution contexts, same dual-context resolution as gardenia's `SpaceInterceptor`); no-op passthrough when unset; otherwise wraps `next.handle()` in `knowledgeBaseContext.run(id, () => ...)`
- [x] 1.5 Create `src/core/tenancy/tenancy.module.ts` — `@Global()`; `providers: [KnowledgeBaseContext]`; `exports: [KnowledgeBaseContext]`

## Phase 2: Domain

- [x] 2.1 Create `src/contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object.ts` — extends `UuidValueObject`
- [x] 2.2 Create `src/contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object.ts` — extends `StringValueObject`; non-empty, 1–100 chars
- [x] 2.3 Create `src/contexts/knowledge-bases/domain/value-objects/knowledge-base-description/knowledge-base-description.value-object.ts` — extends `StringValueObject`; nullable (wraps `null`), max 2000 chars when set
- [x] 2.4 Create `src/contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object.ts` — extends `StringValueObject`; validates `/^[0-9a-f]{64}$/`, throws `InvalidKnowledgeBaseApiKeyHashException` otherwise (mirrors `RefreshTokenHashValueObject` in gardenia's `auth` context exactly)
- [x] 2.5 Create `src/contexts/knowledge-bases/domain/events/interfaces/knowledge-base-event-data.interface.ts` — `IKnowledgeBaseEventData { id, name }`
- [x] 2.6 Create `src/contexts/knowledge-bases/domain/events/knowledge-base-created/knowledge-base-created.event.ts`
- [x] 2.7 Create `src/contexts/knowledge-bases/domain/events/knowledge-base-updated/knowledge-base-updated.event.ts`
- [x] 2.8 Create `src/contexts/knowledge-bases/domain/events/knowledge-base-deleted/knowledge-base-deleted.event.ts` — this is the event `documents`/`retrieval` will subscribe to in future changes
- [x] 2.9 Create `src/contexts/knowledge-bases/domain/events/knowledge-base-api-key-rotated/knowledge-base-api-key-rotated.event.ts` — payload does NOT include the new key or hash (event data must never carry credential material)
- [x] 2.10 Create `src/contexts/knowledge-bases/domain/exceptions/knowledge-base-not-found.exception.ts` — HTTP 404
- [x] 2.11 Create `src/contexts/knowledge-bases/domain/exceptions/knowledge-base-unauthorized.exception.ts` — HTTP 401; thrown by the guard, not a domain method
- [x] 2.12 Create `src/contexts/knowledge-bases/domain/exceptions/invalid-knowledge-base-api-key-hash.exception.ts` — domain invariant, thrown from the VO
- [x] 2.13 Create `src/contexts/knowledge-bases/domain/interfaces/knowledge-base.interface.ts` — all fields as value objects
- [x] 2.14 Create `src/contexts/knowledge-bases/domain/primitives/knowledge-base.primitives.ts` — `IKnowledgeBasePrimitives extends BasePrimitives`; raw types; `IKnowledgeBaseBasePrimitives` for partial update input
- [x] 2.15 Create `src/contexts/knowledge-bases/domain/view-models/knowledge-base.view-model.ts` — `KnowledgeBaseViewModel extends BaseViewModel`; includes `apiKeyHash` (needed for the guard's lookup) but transport mappers MUST never serialize it into a response DTO
- [x] 2.16 Create `src/contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository.ts` — `IKnowledgeBaseWriteRepository extends IBaseWriteRepository<KnowledgeBaseAggregate>` + `KNOWLEDGE_BASE_WRITE_REPOSITORY` token
- [x] 2.17 Create `src/contexts/knowledge-bases/domain/repositories/read/knowledge-base-read.repository.ts` — `IKnowledgeBaseReadRepository extends IBaseReadRepository<KnowledgeBaseViewModel>` + `findByApiKeyHash(hash: string): Promise<KnowledgeBaseViewModel | null>` + `KNOWLEDGE_BASE_READ_REPOSITORY` token
- [x] 2.18 Create `src/contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate.ts` — `create(props)` (emits `KnowledgeBaseCreated`); `update(patch: { name?, description? })` (emits `KnowledgeBaseUpdated`); `delete()` (emits `KnowledgeBaseDeleted`); `rotateApiKey(newHash: KnowledgeBaseApiKeyHashValueObject)` (replaces `apiKeyHash`, emits `KnowledgeBaseApiKeyRotated`); constructor = hydration only
- [x] 2.19 Create `src/contexts/knowledge-bases/domain/builders/knowledge-base.builder.ts` — extends `BaseBuilder`; fluent API (`withId`, `withName`, `withDescription`, `withApiKeyHash`); `buildAggregate()` + `buildViewModel()`

## Phase 3: Application

- [x] 3.1 Create `src/contexts/knowledge-bases/application/services/write/generate-api-key/generate-api-key.service.ts` — `execute(): string`, returns `` `kb_${crypto.randomBytes(32).toString('base64url')}` `` (Node `crypto`, no external dep)
- [x] 3.2 Create `src/contexts/knowledge-bases/application/services/write/hash-api-key/hash-api-key.service.ts` — `execute(rawKey: string): string`, returns `crypto.createHash('sha256').update(rawKey).digest('hex')`
- [x] 3.3 Create `src/contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service.ts` — injects `IKnowledgeBaseWriteRepository`; throws `KnowledgeBaseNotFoundException` when aggregate is null
- [x] 3.4 Create `src/contexts/knowledge-bases/application/services/read/assert-knowledge-base-view-model-exists/assert-knowledge-base-view-model-exists.service.ts` — injects `IKnowledgeBaseReadRepository`; throws `KnowledgeBaseNotFoundException` when VM is null
- [x] 3.5 Create `src/contexts/knowledge-bases/application/commands/create-knowledge-base/create-knowledge-base.command.ts` — `CreateKnowledgeBaseCommandInput { name: string; description?: string }`; `CreateKnowledgeBaseCommand` with VO fields
- [x] 3.6 Create `src/contexts/knowledge-bases/application/commands/create-knowledge-base/create-knowledge-base.handler.ts` — generates raw key + hash, builds aggregate via builder (id = `UuidValueObject.generate()`), calls `aggregate.create()`, saves, publishes events, logs completion (id only, never the key); returns `{ id, name, description, apiKey: <raw>, createdAt }`
- [x] 3.7 Create `src/contexts/knowledge-bases/application/commands/update-knowledge-base/update-knowledge-base.command.ts` — input: `id`, partial `{ name?, description? }`
- [x] 3.8 Create `src/contexts/knowledge-bases/application/commands/update-knowledge-base/update-knowledge-base.handler.ts` — uses `AssertKnowledgeBaseExistsService`; calls `aggregate.update(patch)`; saves; publishes events
- [x] 3.9 Create `src/contexts/knowledge-bases/application/commands/delete-knowledge-base/delete-knowledge-base.command.ts` — input: `id`
- [x] 3.10 Create `src/contexts/knowledge-bases/application/commands/delete-knowledge-base/delete-knowledge-base.handler.ts` — uses `AssertKnowledgeBaseExistsService`; calls `aggregate.delete()`; saves (or hard-deletes per repository implementation); publishes events
- [x] 3.11 Create `src/contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.command.ts` — input: `id`
- [x] 3.12 Create `src/contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.handler.ts` — uses `AssertKnowledgeBaseExistsService`; generates new raw key + hash; calls `aggregate.rotateApiKey(hash)`; saves; publishes events; returns `{ apiKey: <raw> }` only — never logs the key
- [x] 3.13 Create `src/contexts/knowledge-bases/application/queries/knowledge-base-find-by-id/knowledge-base-find-by-id.query.ts` — input: `id`
- [x] 3.14 Create `src/contexts/knowledge-bases/application/queries/knowledge-base-find-by-id/knowledge-base-find-by-id.handler.ts` — calls `readRepository.findById()`; returns `KnowledgeBaseViewModel | null`; logs at entry
- [x] 3.15 Create `src/contexts/knowledge-bases/application/queries/knowledge-base-find-by-api-key-hash/knowledge-base-find-by-api-key-hash.query.ts` — input: `hash`; internal-only, no transport surface
- [x] 3.16 Create `src/contexts/knowledge-bases/application/queries/knowledge-base-find-by-api-key-hash/knowledge-base-find-by-api-key-hash.handler.ts` — calls `readRepository.findByApiKeyHash()`; returns `KnowledgeBaseViewModel | null`; logs at entry with a hash prefix only (never the full hash, never the raw key)

## Phase 4: Infrastructure

- [x] 4.1 Create `src/contexts/knowledge-bases/infrastructure/persistence/typeorm/entities/knowledge-base.entity.ts` — `knowledge_bases` table; columns: `id`, `name` (varchar 100), `description` (text, nullable), `api_key_hash` (varchar 64, unique), `created_at`, `updated_at`; `@Index('UQ_knowledge_bases_api_key_hash', ['apiKeyHash'], { unique: true })`
- [x] 4.2 Create `src/contexts/knowledge-bases/infrastructure/persistence/typeorm/mappers/knowledge-base-typeorm.mapper.ts` — `toDomain(entity): KnowledgeBaseAggregate` via builder; `toPersistence(aggregate): KnowledgeBaseEntity` via `toPrimitives()`; `toViewModel(entity): KnowledgeBaseViewModel`
- [x] 4.3 Create `src/contexts/knowledge-bases/infrastructure/persistence/typeorm/repositories/knowledge-base-typeorm-write.repository.ts` — implements `IKnowledgeBaseWriteRepository`; plain `@InjectRepository(KnowledgeBaseEntity)` — **no** `createTenantRepository` wrapping (see design.md rationale); `findById`, `save`, `delete`
- [x] 4.4 Create `src/contexts/knowledge-bases/infrastructure/persistence/typeorm/repositories/knowledge-base-typeorm-read.repository.ts` — implements `IKnowledgeBaseReadRepository`; plain repo; `findById`, `findByApiKeyHash` (`WHERE api_key_hash = :hash`)
- [x] 4.5 Create `src/database/migrations/1780000000001-CreateKnowledgeBases.ts` — `up()` creates `knowledge_bases` with all columns and the unique index; `down()` drops the table
- [x] 4.6 Create `src/core/tenancy/skip-knowledge-base-auth.decorator.ts` — `SkipKnowledgeBaseAuth = () => SetMetadata(SKIP_KNOWLEDGE_BASE_AUTH_KEY, true)`, exports the metadata key. **Relocated from `src/contexts/knowledge-bases/infrastructure/decorators/`** — see design.md's Technical Approach correction: proven cross-cutting once a second context (`documents`) needed the same guard.
- [x] 4.7 Create `src/core/tenancy/knowledge-base-api-key.guard.ts` — `KnowledgeBaseApiKeyGuard implements CanActivate`; skips when `@SkipKnowledgeBaseAuth()` present (checked via `Reflector`); reads `X-API-Key` header (dual HTTP/GraphQL context resolution like gardenia's `SpaceGuard`); missing header → `KnowledgeBaseUnauthorizedException`; hashes via `HashApiKeyService`; dispatches `KnowledgeBaseFindByApiKeyHashQuery` via `QueryBus`; not found → `KnowledgeBaseUnauthorizedException`; found → `req.knowledgeBaseId = viewModel.id`. **Relocated from `src/contexts/knowledge-bases/infrastructure/guards/`**, registered in `TenancyModule` (providers + exports) instead of `KnowledgeBasesModule`. Also added `src/core/tenancy/current-knowledge-base-id.decorator.ts` (moved alongside it, was previously under the context's `infrastructure/decorators/`).

## Phase 5: Transport

- [x] 5.1 Create `src/contexts/knowledge-bases/transport/rest/dtos/create-knowledge-base.dto.ts` — `name` (IsString, Length 1-100, required), `description` (IsString, MaxLength 2000, IsOptional)
- [x] 5.2 Create `src/contexts/knowledge-bases/transport/rest/dtos/update-knowledge-base.dto.ts` — same fields, all optional
- [x] 5.3 Create `src/contexts/knowledge-bases/transport/rest/dtos/knowledge-base-rest-response.dto.ts` — `id`, `name`, `description`, `createdAt`, `updatedAt` — **no `apiKeyHash`, no `apiKey`**
- [x] 5.4 Create `src/contexts/knowledge-bases/transport/rest/dtos/knowledge-base-created-rest-response.dto.ts` — extends the above response shape + `apiKey: string`, documented in Swagger as "shown once, store it now"
- [x] 5.5 Create `src/contexts/knowledge-bases/transport/rest/mappers/knowledge-base/knowledge-base.mapper.ts` — `KnowledgeBaseViewModel → KnowledgeBaseRestResponseDto` (strips `apiKeyHash`)
- [x] 5.6 Create `src/contexts/knowledge-bases/transport/rest/controllers/knowledge-bases.controller.ts` — `POST /knowledge-bases` (`@SkipKnowledgeBaseAuth()`, dispatches `CreateKnowledgeBaseCommand`, returns `KnowledgeBaseCreatedRestResponseDto`); `GET /knowledge-bases/me`, `PATCH /knowledge-bases/me`, `DELETE /knowledge-bases/me`, `POST /knowledge-bases/me/rotate-api-key` (all `@UseGuards(KnowledgeBaseApiKeyGuard)`, id from `req.knowledgeBaseId`, never from a param); log at entry of each method; dispatch via `CommandBus`/`QueryBus`
- [x] 5.7 Create `src/contexts/knowledge-bases/transport/graphql/dtos/requests/create-knowledge-base-graphql.dto.ts` — `@InputType()`
- [x] 5.8 Create `src/contexts/knowledge-bases/transport/graphql/dtos/requests/update-knowledge-base-graphql.dto.ts` — `@InputType()`, all optional
- [x] 5.9 Create `src/contexts/knowledge-bases/transport/graphql/dtos/responses/knowledge-base.response.dto.ts` — `@ObjectType('KnowledgeBaseResponseDto')`; no `apiKeyHash`/`apiKey` field
- [x] 5.10 Create `src/contexts/knowledge-bases/transport/graphql/dtos/responses/knowledge-base-created.response.dto.ts` — `@ObjectType('KnowledgeBaseCreatedResponseDto')`; includes `apiKey: string`
- [x] 5.11 Create `src/contexts/knowledge-bases/transport/graphql/mappers/knowledge-base/knowledge-base.mapper.ts`
- [x] 5.12 Create `src/contexts/knowledge-bases/transport/graphql/resolvers/knowledge-base-mutations.resolver.ts` — `createKnowledgeBase(input)` (`@SkipKnowledgeBaseAuth()`), `updateKnowledgeBase(input)`, `deleteKnowledgeBase` (returns `Boolean`), `rotateKnowledgeBaseApiKey` (returns `KnowledgeBaseCreatedResponseDto`-shaped key object); guards: `KnowledgeBaseApiKeyGuard` on all but create; `CommandBus` only; logs at entry
- [x] 5.13 Create `src/contexts/knowledge-bases/transport/graphql/resolvers/knowledge-base-queries.resolver.ts` — `knowledgeBase` (no args — self lookup via `req.knowledgeBaseId`); guard: `KnowledgeBaseApiKeyGuard`; `QueryBus` only

## Phase 6: Module Wiring

- [x] 6.1 Create `src/contexts/knowledge-bases/knowledge-bases.module.ts` — named const arrays: `COMMAND_HANDLERS`, `QUERY_HANDLERS`, `APPLICATION_SERVICES`, `DOMAIN_BUILDERS`, `INFRASTRUCTURE_REPOSITORIES` (bound to `KNOWLEDGE_BASE_WRITE_REPOSITORY`/`KNOWLEDGE_BASE_READ_REPOSITORY` via `useClass`), `INFRASTRUCTURE_MAPPERS`, `INFRASTRUCTURE_ENTITIES`, `TRANSPORT_PROVIDERS` (includes `KnowledgeBaseApiKeyGuard`); import `TypeOrmModule.forFeature([KnowledgeBaseEntity])`; import `CqrsModule`
- [x] 6.2 Modify `src/core/core.module.ts` — add `TenancyModule` to `CORE_MODULES` (import from `@core/tenancy/tenancy.module` or relative path matching existing core import style)
- [x] 6.3 Modify `src/contexts/contexts.module.ts` — add `KnowledgeBasesModule` to `CONTEXT_MODULES`

## Phase 7: Context README

- [x] 7.1 Create `src/contexts/knowledge-bases/README.md` — document the context purpose, aggregate fields, commands, queries, the API-key auth flow end-to-end (including the `/me` route pattern and why there's no `:id` param), the `KnowledgeBaseDeleted` event as the future cascade hook, and explicitly note the two deviations from the standard context template (no `findByCriteria`, no MCP tools) with their rationale so the next contributor doesn't "fix" them without reading this first.

## Phase 8: Tests

- [x] 8.1 Unit — `knowledge-base-name.value-object.spec.ts`: empty string throws; 101-char string throws; valid accepted
- [x] 8.2 Unit — `knowledge-base-description.value-object.spec.ts`: null accepted; 2001-char string throws
- [x] 8.3 Unit — `knowledge-base-api-key-hash.value-object.spec.ts`: valid 64-hex accepted; short/non-hex string throws `InvalidKnowledgeBaseApiKeyHashException`
- [x] 8.4 Unit — `knowledge-base.aggregate.spec.ts`: `create()` emits `KnowledgeBaseCreated` (SC-01); `update()` emits `KnowledgeBaseUpdated`; `delete()` emits `KnowledgeBaseDeleted`; `rotateApiKey()` replaces hash and emits `KnowledgeBaseApiKeyRotated` (SC-10), event payload does not contain the hash
- [x] 8.5 Unit — `generate-api-key.service.spec.ts`: returns string starting with `kb_`; two calls produce different keys
- [x] 8.6 Unit — `hash-api-key.service.spec.ts`: same input → same 64-hex output (determinism); different input → different output
- [x] 8.7 Unit — `create-knowledge-base.handler.spec.ts`: happy path saves aggregate with hash (not raw key), returns raw key in result (SC-01); result never contains `apiKeyHash`
- [x] 8.8 Unit — `update-knowledge-base.handler.spec.ts`: happy path (SC-02); unknown id → `KnowledgeBaseNotFoundException` (SC-05)
- [x] 8.9 Unit — `delete-knowledge-base.handler.spec.ts`: happy path (SC-03); unknown id → 404
- [x] 8.10 Unit — `rotate-knowledge-base-api-key.handler.spec.ts`: old hash no longer matches after rotation, new raw key returned (SC-10)
- [x] 8.11 Unit — `knowledge-base-find-by-api-key-hash.handler.spec.ts`: returns VM when hash matches; returns null otherwise (SC-06)
- [x] 8.12 Unit — `assert-knowledge-base-exists.service.spec.ts`: null aggregate → throws `KnowledgeBaseNotFoundException`
- [x] 8.13 Unit — `knowledge-base-api-key.guard.spec.ts`: `@SkipKnowledgeBaseAuth()` → `canActivate` true without dispatching any query (SC-04); missing `X-API-Key` header → `KnowledgeBaseUnauthorizedException` (SC-07); unknown key → `KnowledgeBaseUnauthorizedException` (SC-06); valid key → sets `req.knowledgeBaseId`, returns true (SC-08)
- [x] 8.14 Unit — `create-tenant-repository.factory.spec.ts`: `find`/`findOne`/`findAndCount` receive injected `where.knowledgeBaseId`; `save` receives injected `knowledgeBaseId`; `delete` criteria receives injected `knowledgeBaseId`; `ctx.require()` throwing propagates (no silent no-op)
- [x] 8.15 Unit — `knowledge-base-context.service.spec.ts`: `run()` scopes `get()` to the callback; concurrent `run()` calls (via `Promise.all`) don't leak each other's `knowledgeBaseId` (ALS isolation)
- [x] 8.16 Unit — `knowledge-base-context.interceptor.spec.ts`: no `req.knowledgeBaseId` → passthrough, `run()` never called; present → wraps `next.handle()` in `context.run()`
- [x] 8.17 Integration — `knowledge-base-typeorm-write.repository.integration-spec.ts`: save + findById round-trip; unique constraint violation on duplicate `api_key_hash` (extremely unlikely in practice, still verified)
- [x] 8.18 Integration — `knowledge-base-typeorm-read.repository.integration-spec.ts`: `findByApiKeyHash` returns the matching row (SC-06); returns null for a hash that doesn't exist
- [x] 8.19 E2E — `knowledge-bases-rest.e2e-spec.ts`: `POST /knowledge-bases` → 201, response includes plaintext `apiKey` (SC-01); `GET /knowledge-bases/me` without header → 401 (SC-07); with wrong key → 401 (SC-06); with correct key → 200, response has no `apiKeyHash`/`apiKey` field (SC-08); `PATCH /knowledge-bases/me` updates name (SC-02); `DELETE /knowledge-bases/me` then `GET` → 401 (not 404 — the key no longer resolves to anything) (SC-03); `POST /knowledge-bases/me/rotate-api-key` → new key works, old key now 401 (SC-10)
- [x] 8.20 E2E — `knowledge-bases-graphql.e2e-spec.ts`: `createKnowledgeBase` mutation (SC-01); `knowledgeBase` query without `X-API-Key` header → GraphQL error (SC-07); with valid key → returns own KB only, no id argument accepted by the schema (SC-09)
