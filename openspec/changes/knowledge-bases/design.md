# Design: KnowledgeBase bounded context

## Technical Approach

Mirror `gardenia-api`'s tenancy mechanism (`spaces` context +
`shared/space-context` + `shared/tenant-repository`), adapted for API-key
auth instead of JWT+membership:

- **Generic ALS + proxy mechanism** (`KnowledgeBaseContext`,
  `createTenantRepository`, `KnowledgeBaseContextInterceptor`) is
  context-agnostic — any future context's repository can wrap itself with
  `createTenantRepository(rawRepo, knowledgeBaseContext)` to get automatic
  `knowledgeBaseId` scoping on `find`/`save`/`delete`. Per shiori's own
  `architecture` skill ("cross-context shared utilities → `src/core/`"), this
  lives in `src/core/tenancy/`, not inside the `knowledge-bases` context
  itself — gardenia put the equivalent in `src/shared/` because that
  template has no `src/core/` cross-cutting convention; shiori does.
- **Credential guard** (`KnowledgeBaseApiKeyGuard`) also lives in
  `src/core/tenancy/`, alongside the ALS mechanism — **correction from the
  original plan**: it was first placed inside
  `src/contexts/knowledge-bases/infrastructure/guards/`, mirroring how
  gardenia splits `SpaceContext` (shared) from `SpaceGuard` (inside
  `contexts/spaces/`). That reasoning assumed only `knowledge-bases` itself
  would ever need it. It doesn't hold: every future context needs the same
  guard to authenticate its own routes, and gardenia's split works there
  only because gardenia's auth is JWT+membership (a generic `JwtAuthGuard`
  already lives outside `spaces`, and `SpaceGuard` layers tenant membership
  on top for space-scoped routes specifically). Shiori has no such second
  guard to delegate to — API-key resolution *is* the whole auth mechanism —
  so it has to be the cross-cutting one. Moved to `src/core/tenancy/` before
  this PR's history includes a consumer proving the point (see the
  `documents` change). It still imports
  `KnowledgeBaseFindByApiKeyHashQuery` from `@contexts/knowledge-bases/`,
  which is fine — `src/core/**` is exempt from the boundaries ESLint rule
  (`boundaries/include` only covers `src/contexts/**`), the same precedent
  `core/filters/base-exception.filter.ts` already uses.
- The `knowledge-bases` context's **own** repositories are *not*
  tenant-scoped by `createTenantRepository` — a knowledge base IS the tenant
  root, there is nothing above it to scope by. `createTenantRepository` has
  zero consumers within this change; it exists as the seam `documents` and
  `retrieval` will consume when they're proposed. This resolves what would
  otherwise be a chicken-and-egg problem: you cannot require
  `knowledgeBaseId` in ALS before the guard has resolved it from the API key.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|----------|--------|------------------------|-----------|
| Tenant credential | Single active API key per KB, SHA-256 hash persisted, plaintext returned once | JWT+membership (gardenia's model) | No user/account concept in MVP scope — the key itself is the identity, matching the earlier debate decision |
| Tenancy mechanism location | `src/core/tenancy/` for everything — ALS, proxy, **and** `KnowledgeBaseApiKeyGuard` | Guard inside `knowledge-bases` context (original plan, corrected — see Technical Approach) | Matches shiori's own skill ("shared utilities → `src/core/`"); every context needs the same guard, not just `knowledge-bases`, so it can't live inside one context's ownership without forcing cross-context imports the boundaries ESLint rule rejects |
| `knowledge-bases`' own repos | Plain TypeORM repos, no `createTenantRepository` wrapping | Self-scope by own `id` | A KB is the tenant root; nothing scopes it. Avoids the bootstrap chicken-and-egg (guard needs to read KB *before* ALS has a tenant id) |
| `KnowledgeBaseFindByCriteria` | **Omitted** — deliberate exception to the "mandatory, no exception" Criteria rule | Implement per rule | No caller in this auth model is authorized to list across tenants; a working list endpoint would be a data-leak vector via a wiring mistake. See `proposal.md` Deviation 1 |
| Self-service routes (no `:id`) | `GET/PATCH/DELETE /knowledge-bases/me`, `POST /knowledge-bases/me/rotate-api-key` — id always resolved from the authenticated API key, never from a path/arg param | `GET /knowledge-bases/:id` with a guard-vs-param match check | Removes an entire class of confused-deputy bugs (guard resolves KB A, param requests KB B) by construction — there's no param to mismatch |
| `CreateKnowledgeBase` auth | Unauthenticated (no guard) | Require a bootstrap/admin secret | MVP default, functions like a "signup". Flagged as an Open Question below — self-hosted operators may want to gate it |
| API key format | `kb_` prefix + 32 random bytes, base64url-encoded (43 chars) — plaintext; SHA-256 hex digest (64 chars) persisted | UUID-based key | Prefix makes keys visually identifiable/greppable in logs (and greppable-and-revocable, a common practice); hash format mirrors `RefreshTokenHashValueObject` in gardenia's `auth` context exactly |
| MCP tools | None for this context | Expose read-only `knowledge_base_find_by_id` tool | `AGENTS.md`: credential/session contexts require an explicit decision to expose over MCP. Every command here is credential-adjacent; the one read query is self-lookup only, low value to expose alone |
| Migration numbering | `1780000000001-CreateKnowledgeBases` | Any epoch-like prefix | First migration in this service; `1780000000001` establishes the sequence gardenia's numbering style continues from (`...0016` was gardenia's latest) |

## Data Flow

```
Create (no guard):
REST/GraphQL ──> CreateKnowledgeBaseCommand
     │
CommandBus ──> Handler ──> GenerateApiKeyService (raw key)
     │                 ──> HashApiKeyService (SHA-256)
     │                 ──> Builder ──> Aggregate.create() ──emits──> KnowledgeBaseCreated
     │                 ──> WriteRepo.save() (plain repo, no tenant scoping)
     └──> Handler returns { id, name, description, apiKey: <plaintext>, createdAt }
          (apiKey is NEVER persisted in plaintext and NEVER returned again)

Authenticated request (any future "me" route):
REST/GraphQL ──(KnowledgeBaseApiKeyGuard)──> reads `X-API-Key` header
     │
     ├─ HashApiKeyService.execute(rawKey) ──> hash
     ├─ QueryBus.execute(KnowledgeBaseFindByApiKeyHashQuery(hash))
     │      ──> Handler ──> ReadRepo.findByApiKeyHash(hash) ──> ViewModel | null
     ├─ null ──> KnowledgeBaseUnauthorizedException (401)
     └─ found ──> req.knowledgeBaseId = viewModel.id
                    │
              KnowledgeBaseContextInterceptor
                    │  wraps next.handle() in
                    │  knowledgeBaseContext.run(req.knowledgeBaseId, () => ...)
                    ▼
              Handler / (future) tenant-scoped repositories read via
              KnowledgeBaseContext.require()
```

## File Changes

All new files, two roots: `src/core/tenancy/` (cross-cutting) and
`src/contexts/knowledge-bases/` (context). Tree (≈57 files):

```
src/core/tenancy/
  knowledge-base-context.service.ts       — AsyncLocalStorage<{ knowledgeBaseId }>, .get()/.require()
  knowledge-base-context.service.spec.ts
  create-tenant-repository.factory.ts     — Proxy<Repository<E extends { knowledgeBaseId: string }>>
  create-tenant-repository.factory.spec.ts
  knowledge-base-context.interceptor.ts   — opens ALS frame around next.handle()
  knowledge-base-context.interceptor.spec.ts
  knowledge-base-api-key.guard.ts         — resolves X-API-Key via KnowledgeBaseFindByApiKeyHashQuery
  knowledge-base-api-key.guard.spec.ts
  skip-knowledge-base-auth.decorator.ts
  current-knowledge-base-id.decorator.ts
  tenancy.module.ts                       — @Global(); exports KnowledgeBaseContext + KnowledgeBaseApiKeyGuard

src/contexts/knowledge-bases/
  domain/
    aggregates/knowledge-base.aggregate.ts
    aggregates/knowledge-base.aggregate.spec.ts
    builders/knowledge-base.builder.ts
    builders/knowledge-base.builder.spec.ts
    events/interfaces/knowledge-base-event-data.interface.ts
    events/knowledge-base-created/knowledge-base-created.event.ts
    events/knowledge-base-updated/knowledge-base-updated.event.ts
    events/knowledge-base-deleted/knowledge-base-deleted.event.ts
    events/knowledge-base-api-key-rotated/knowledge-base-api-key-rotated.event.ts
    exceptions/knowledge-base-not-found.exception.ts        # 404
    exceptions/knowledge-base-unauthorized.exception.ts      # 401
    exceptions/invalid-knowledge-base-api-key-hash.exception.ts  # domain invariant
    interfaces/knowledge-base.interface.ts
    primitives/knowledge-base.primitives.ts
    repositories/read/knowledge-base-read.repository.ts
    repositories/write/knowledge-base-write.repository.ts
    value-objects/knowledge-base-id/knowledge-base-id.value-object.ts
    value-objects/knowledge-base-id/knowledge-base-id.value-object.spec.ts
    value-objects/knowledge-base-name/knowledge-base-name.value-object.ts
    value-objects/knowledge-base-name/knowledge-base-name.value-object.spec.ts
    value-objects/knowledge-base-description/knowledge-base-description.value-object.ts
    value-objects/knowledge-base-description/knowledge-base-description.value-object.spec.ts
    value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object.ts
    value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object.spec.ts
    view-models/knowledge-base.view-model.ts
  application/
    services/write/generate-api-key/generate-api-key.service.ts
    services/write/generate-api-key/generate-api-key.service.spec.ts
    services/write/hash-api-key/hash-api-key.service.ts
    services/write/hash-api-key/hash-api-key.service.spec.ts
    services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service.ts
    services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service.spec.ts
    services/read/assert-knowledge-base-view-model-exists/assert-knowledge-base-view-model-exists.service.ts
    services/read/assert-knowledge-base-view-model-exists/assert-knowledge-base-view-model-exists.service.spec.ts
    commands/create-knowledge-base/create-knowledge-base.command.ts
    commands/create-knowledge-base/create-knowledge-base.handler.ts
    commands/create-knowledge-base/create-knowledge-base.handler.spec.ts
    commands/update-knowledge-base/update-knowledge-base.command.ts
    commands/update-knowledge-base/update-knowledge-base.handler.ts
    commands/update-knowledge-base/update-knowledge-base.handler.spec.ts
    commands/delete-knowledge-base/delete-knowledge-base.command.ts
    commands/delete-knowledge-base/delete-knowledge-base.handler.ts
    commands/delete-knowledge-base/delete-knowledge-base.handler.spec.ts
    commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.command.ts
    commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.handler.ts
    commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.handler.spec.ts
    queries/knowledge-base-find-by-id/knowledge-base-find-by-id.query.ts
    queries/knowledge-base-find-by-id/knowledge-base-find-by-id.handler.ts
    queries/knowledge-base-find-by-id/knowledge-base-find-by-id.handler.spec.ts
    queries/knowledge-base-find-by-api-key-hash/knowledge-base-find-by-api-key-hash.query.ts
    queries/knowledge-base-find-by-api-key-hash/knowledge-base-find-by-api-key-hash.handler.ts
    queries/knowledge-base-find-by-api-key-hash/knowledge-base-find-by-api-key-hash.handler.spec.ts
  infrastructure/
    persistence/typeorm/entities/knowledge-base.entity.ts
    persistence/typeorm/mappers/knowledge-base-typeorm.mapper.ts
    persistence/typeorm/mappers/knowledge-base-typeorm.mapper.spec.ts
    persistence/typeorm/repositories/knowledge-base-typeorm-write.repository.ts
    persistence/typeorm/repositories/knowledge-base-typeorm-write.repository.spec.ts
    persistence/typeorm/repositories/knowledge-base-typeorm-read.repository.ts
    persistence/typeorm/repositories/knowledge-base-typeorm-read.repository.spec.ts
  transport/
    rest/controllers/knowledge-bases.controller.ts
    rest/controllers/knowledge-bases.controller.spec.ts
    rest/dtos/create-knowledge-base.dto.ts
    rest/dtos/update-knowledge-base.dto.ts
    rest/dtos/knowledge-base-rest-response.dto.ts
    rest/dtos/knowledge-base-created-rest-response.dto.ts
    rest/mappers/knowledge-base/knowledge-base.mapper.ts
    graphql/dtos/requests/create-knowledge-base-graphql.dto.ts
    graphql/dtos/requests/update-knowledge-base-graphql.dto.ts
    graphql/dtos/responses/knowledge-base.response.dto.ts
    graphql/dtos/responses/knowledge-base-created.response.dto.ts
    graphql/mappers/knowledge-base/knowledge-base.mapper.ts
    graphql/resolvers/knowledge-base-mutations.resolver.ts
    graphql/resolvers/knowledge-base-mutations.resolver.spec.ts
    graphql/resolvers/knowledge-base-queries.resolver.ts
    graphql/resolvers/knowledge-base-queries.resolver.spec.ts
  knowledge-bases.module.ts
  README.md
```

Modified files:

| File | Action | Description |
|------|--------|-------------|
| `src/database/migrations/1780000000001-CreateKnowledgeBases.ts` | Create | `knowledge_bases` table + unique index on `api_key_hash` |
| `src/core/core.module.ts` | Modify | Add `TenancyModule` to `CORE_MODULES` |
| `src/contexts/contexts.module.ts` | Modify | Add `KnowledgeBasesModule` to `CONTEXT_MODULES` |

## Interfaces / Contracts

```ts
// src/core/tenancy/knowledge-base-context.service.ts
@Injectable()
export class KnowledgeBaseContext {
  private readonly als = new AsyncLocalStorage<{ knowledgeBaseId: string }>();
  run<T>(knowledgeBaseId: string, fn: () => T): T { ... }
  get(): string | undefined { ... }
  require(): string { ... } // throws KnowledgeBaseContextMissingException
}

// src/core/tenancy/create-tenant-repository.factory.ts
export function createTenantRepository<E extends { knowledgeBaseId: string }>(
  repo: Repository<E>,
  ctx: KnowledgeBaseContext,
): Repository<E>; // Proxy over find/findOne/findAndCount/save/delete

// src/contexts/knowledge-bases/domain/repositories/read/knowledge-base-read.repository.ts
export const KNOWLEDGE_BASE_READ_REPOSITORY = Symbol('KNOWLEDGE_BASE_READ_REPOSITORY');
export interface IKnowledgeBaseReadRepository
  extends IBaseReadRepository<KnowledgeBaseViewModel> {
  findByApiKeyHash(hash: string): Promise<KnowledgeBaseViewModel | null>;
}

// src/contexts/knowledge-bases/application/commands/create-knowledge-base/create-knowledge-base.handler.ts
async execute(command: CreateKnowledgeBaseCommand): Promise<{
  id: string;
  name: string;
  description: string | null;
  apiKey: string;   // plaintext — only ever returned here
  createdAt: Date;
}>;

// src/contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.handler.ts
async execute(command: RotateKnowledgeBaseApiKeyCommand): Promise<{ apiKey: string }>;
```

## Database Schema

Table: `knowledge_bases`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | No | PK |
| name | varchar(100) | No | |
| description | text | Yes | Max 2000 chars, enforced in domain |
| api_key_hash | varchar(64) | No | SHA-256 hex digest; unique |
| created_at | TIMESTAMPTZ | No | |
| updated_at | TIMESTAMPTZ | No | |

Indexes:
- `UQ_knowledge_bases_api_key_hash` — unique index on `(api_key_hash)`. Both a
  business invariant and the guard's hot lookup path (runs on every
  authenticated request).

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | VO validation (name length, description length, api-key-hash format), aggregate `create()`/`update()`/`delete()` event emission, `GenerateApiKeyService` format, `HashApiKeyService` determinism, command handlers (happy path + not-found), `KnowledgeBaseApiKeyGuard` (valid key, missing header, unknown key, skip-decorator bypass), `createTenantRepository` proxy behavior, `KnowledgeBaseContext` ALS isolation across concurrent runs | Jest, `jest.Mocked<T>` |
| Integration | `KnowledgeBaseTypeOrmWriteRepository`/`ReadRepository` against real Postgres; `findByApiKeyHash` returns null for wrong hash; unique constraint on `api_key_hash` | Real Postgres |
| E2E | REST + GraphQL: create (no auth) → key returned once; `/me` routes 401 without key, 401 with wrong key, 200 with right key; rotate invalidates old key immediately (SC-10) | supertest |
| Static | No `*.module.spec.ts` files; ESLint boundaries clean (no premature cross-context import — there is no other context yet, but the guard must not import anything from a future context) | ESLint + existing config |

## Migration / Rollout

Single additive migration `1780000000001-CreateKnowledgeBases`; `down()`
drops `knowledge_bases`. This is the first migration in the service —
`DATABASE_MIGRATIONS_RUN` (default `true` per `.env.example`) applies it on
boot in dev. No data backfill.

## Open Questions

- [ ] Should `CreateKnowledgeBase` require a global bootstrap/admin secret
      (e.g. `ADMIN_BOOTSTRAP_SECRET` env var, checked via a lightweight
      guard) for hardened self-hosted deployments, or stay fully open like a
      public signup? Recommendation: stay open for the MVP — an operator who
      wants to gate signups can put the service behind their own reverse
      proxy / network policy; adding an admin-secret layer now is scope
      creep for a context whose entire job is *being* the auth mechanism for
      everything else.
- [ ] Should key rotation support a brief overlap window (old key valid for
      N minutes after rotation) to avoid a hard cutover for long-running
      clients? Recommendation: no — out of scope per `proposal.md`, revisit
      if real usage shows this is painful.
- [ ] Is SHA-256 sufficient for the API key hash, or should this use a
      slower KDF (bcrypt/argon2) like a password would? Recommendation:
      SHA-256 is correct here — the key itself has 256 bits of entropy from
      `crypto.randomBytes`, so it is not brute-forceable the way a
      human-chosen password is; this exactly matches gardenia's
      `RefreshTokenHashValueObject` precedent, which hashes a
      high-entropy generated token the same way, not a password.
