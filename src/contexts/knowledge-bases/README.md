# `knowledge-bases`

Tenant root for Shiori. Every Knowledge Base is an isolated container
authenticated by its own API key. Future contexts (`documents`, `retrieval`)
will scope their data to a `knowledgeBaseId` resolved by this context's guard,
using the cross-cutting tenancy mechanism this context introduces.

## Aggregate

`KnowledgeBaseAggregate`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `name` | string | 1–100 chars |
| `description` | string \| null | max 2000 chars |
| `apiKeyHash` | string | SHA-256 hex digest of the current active key; never the plaintext |

## Commands

- `CreateKnowledgeBase` — no auth required (this is the tenant-creation
  "signup" entry point). Generates a new API key, persists only its hash,
  returns the **plaintext key in the response — the only time it is ever
  shown**.
- `UpdateKnowledgeBase` — auth required; updates `name`/`description` of the
  caller's own knowledge base.
- `DeleteKnowledgeBase` — auth required; deletes the caller's own knowledge
  base. Emits `KnowledgeBaseDeleted`, the future cascade hook for `documents`
  and `retrieval`.
- `RotateKnowledgeBaseApiKey` — auth required; issues a new key and
  invalidates the previous one immediately (no overlap window). Returns the
  new plaintext key once.

## Queries

- `KnowledgeBaseFindById` — exposed as the `knowledgeBase` GraphQL query and
  `GET /knowledge-bases/me` REST route. Always resolves the **caller's own**
  knowledge base — takes no `id` argument at the transport layer, only the
  `knowledgeBaseId` set by the guard.
- `KnowledgeBaseFindByApiKeyHash` — **internal only**, no transport surface.
  Dispatched exclusively by `KnowledgeBaseApiKeyGuard` to resolve the
  `X-API-Key` header to a tenant.

## Auth: `KnowledgeBaseApiKeyGuard` (`src/core/tenancy/`)

Reads the `X-API-Key` header, hashes it, and dispatches
`KnowledgeBaseFindByApiKeyHashQuery`. No match (or missing header) → 401. A
match sets `req.knowledgeBaseId`, which `KnowledgeBaseContextInterceptor`
then uses to open the `KnowledgeBaseContext` ALS frame for the rest of the
request.

The guard lives in `src/core/tenancy/` (registered globally by
`TenancyModule`, exported for any context to `@UseGuards()`), not inside
this context — every other context needs the exact same guard to
authenticate its own routes, so it can't be owned by `knowledge-bases`
alone. It still depends on `KnowledgeBaseFindByApiKeyHashQuery` from this
context's `application/queries/`, dispatched via the global `QueryBus`.

Routes annotated `@SkipKnowledgeBaseAuth()` bypass the guard — used only by
`CreateKnowledgeBase`, since there is no existing key to authenticate with
at that point.

### Why every route is `/me`, never `/:id`

Every authenticated operation in this context acts on "the knowledge base
identified by the caller's own API key." There is no `GET
/knowledge-bases/:id` — removing the id parameter removes an entire class of
confused-deputy bug (guard resolves knowledge base A, a path param requests
knowledge base B) by construction, since there's nothing to mismatch.

## Cross-cutting tenancy mechanism (`src/core/tenancy/`)

This context's real deliverable, beyond its own CRUD, is the reusable
tenancy seam every future context will consume:

- `KnowledgeBaseContext` — `AsyncLocalStorage`-backed request-scoped
  accessor (`.get()` / `.require()`).
- `createTenantRepository(rawRepo, knowledgeBaseContext)` — wraps a TypeORM
  `Repository<E>` in a `Proxy` that auto-injects `knowledgeBaseId` into
  `find`/`save`/`delete`. **This context's own repositories do NOT use it** —
  a knowledge base is the tenant root, there's nothing above it to scope by,
  and using it here would create a bootstrap chicken-and-egg problem (the
  guard needs to read a knowledge base *before* ALS has a tenant id). Future
  contexts (`documents`, `retrieval`) are the intended consumers.
- `KnowledgeBaseContextInterceptor` — opens the ALS frame around the request
  lifecycle. Must be the interceptor, not the guard: guards resolve before
  the handler executes, so an ALS frame opened in a guard would close before
  the handler chain completes.

`TenancyModule` is `@Global()` and registered in `CoreModule`, so
`KnowledgeBaseContext` is injectable anywhere without each context importing
it explicitly.

## Deliberate deviations from the standard context template

Both are explained in detail in `openspec/changes/knowledge-bases/proposal.md`
(Deviations 1 and 2) and `design.md` (Architecture Decisions) — read those
before "fixing" either of these:

1. **No `KnowledgeBaseFindByCriteria` / list query.** Under API-key-only
   auth, no caller is authorized to see knowledge bases other than their
   own — a list query would be either useless or a cross-tenant data-leak
   vector if ever miswired. `findByCriteria` on both repositories is stubbed
   (`throw new Error('Method not implemented.')`) purely to satisfy the
   `IBaseReadRepository`/`IBaseWriteRepository` interface contract, matching
   the existing codebase convention for unused interface methods (e.g.
   `PlantTypeOrmWriteRepository.findByCriteria` in the sibling `gardenia-api`
   service).
2. **No MCP tools.** Every command here either issues or rotates a
   credential, or mutates the tenant record itself — exactly the
   credential/session case `AGENTS.md` requires an explicit decision to
   expose over MCP for. This context makes that decision "not now."

## Database

Table: `knowledge_bases` (migration `1780000000001-CreateKnowledgeBases`).
Unique index on `api_key_hash` — both a business invariant and the guard's
hot lookup path (runs on every authenticated request).
