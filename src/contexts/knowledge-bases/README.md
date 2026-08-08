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
| `embeddingModel` | string | Free-form model id; validated against `embeddings`' registry at the application layer, not by this context's own value object (see "Embedding model" below) |
| `embeddingStatus` | enum (`READY`\|`REEMBEDDING`\|`FAILED`) | Defaults to `READY` on creation |

## Embedding model

Each Knowledge Base picks its own embedding model at creation time and can
change it later — the model is tenant configuration here, not a global
`.env` value (see `embeddings/README.md`'s "Model registry"). Changing it
triggers a blocking re-embed of every document owned by this Knowledge
Base, run entirely by `embeddings`.

### State machine

```
        CreateKnowledgeBase
               │
               ▼
             READY ───────────────┐
               │  ChangeKnowledgeBaseEmbeddingModel     ReembedKnowledgeBase
               │  (different model)                     (same model, forced)
               ▼                  │                              │
         REEMBEDDING              │ ChangeKnowledgeBaseEmbeddingModel
          │        │              │ (same model → no-op, no transition)
 Complete │        │ Fail         │                              │
 (success)│        │ (error)      │                              │
          ▼        ▼              │                              │
        READY    FAILED ──────────┴──────────────────────────────┘
                    │  ChangeKnowledgeBaseEmbeddingModel (retry)
                    │  ReembedKnowledgeBase (retry)
                    ▼
              REEMBEDDING
```

`ReembedKnowledgeBase` and `ChangeKnowledgeBaseEmbeddingModel` both drive
`READY`/`FAILED → REEMBEDDING` and both publish an event `embeddings` reacts
to by enqueueing the same re-embed job — the difference is entirely in
whether the target model differs from the current one. Unlike
`ChangeKnowledgeBaseEmbeddingModel`, `ReembedKnowledgeBase` never no-ops:
there is no "unchanged model" case to skip, since the model never changes.

- While `REEMBEDDING`: `retrieval`/`embeddings` search is rejected for this
  Knowledge Base (HTTP 409, `EmbeddingSearchNotReadyException`,
  thrown and mapped inside `embeddings`); a second
  `ChangeKnowledgeBaseEmbeddingModel` call with a *different* model is
  rejected (`KnowledgeBaseReembeddingInProgressException`, 409) — no
  concurrent re-embed runs. A call with the *same* model the Knowledge Base
  is already re-embedding to is still a no-op (checked before the
  in-progress check), so retriggering is always safe.
- `FAILED` is a normal, retryable state — calling
  `ChangeKnowledgeBaseEmbeddingModel` again (same or different model) is
  accepted and starts a fresh, clean re-embed attempt.
- The model pointer (`embeddingModel`) flips **immediately** on
  `changeEmbeddingModel()`, not after the re-embed completes — safe because
  nothing reads `embeddingModel` for search purposes while
  `embeddingStatus !== READY`.
- `completeReembedding()`/`failReembedding(reason)` are internal-only
  aggregate mutators — never called directly from a public command, only
  from `CompleteKnowledgeBaseReembeddingCommandHandler`/
  `FailKnowledgeBaseReembeddingCommandHandler` (see "Commands" below),
  themselves dispatched exclusively by `embeddings`' re-embed processor.

`knowledge-bases` deliberately does **not** import `embeddings`' domain
types (e.g. `EmbeddingModelValueObject`) — the cross-context boundary rule
only allows reaching another context's domain/application from
`infrastructure/adapters/`. This context owns its own "what model string
did the caller pick" value object (`KnowledgeBaseEmbeddingModelValueObject`,
a shape-only check); whether that string is a *valid, known* model is
checked via `IEmbeddingModelValidationPort` below, never by sharing a type.

## Commands

- `CreateKnowledgeBase` — no auth required (this is the tenant-creation
  "signup" entry point). Requires `embeddingModel`; validates it against
  `embeddings`' registry via `IEmbeddingModelValidationPort` before
  constructing the aggregate (unknown model → `InvalidKnowledgeBaseEmbeddingModelException`,
  400). Generates a new API key, persists only its hash, returns the
  **plaintext key in the response — the only time it is ever shown**. New
  Knowledge Bases are created with `embeddingStatus = READY`.
- `UpdateKnowledgeBase` — auth required; updates `name`/`description` of the
  caller's own knowledge base.
- `DeleteKnowledgeBase` — auth required; deletes the caller's own knowledge
  base. Emits `KnowledgeBaseDeleted`, the future cascade hook for `documents`
  and `retrieval`.
- `RotateKnowledgeBaseApiKey` — auth required; issues a new key and
  invalidates the previous one immediately (no overlap window). Returns the
  new plaintext key once.
- `ChangeKnowledgeBaseEmbeddingModel` — auth required (`PATCH
  /knowledge-bases/me/embedding-model`, GraphQL mutation
  `changeKnowledgeBaseEmbeddingModel`, both resolving the caller's own
  Knowledge Base the same way every other authenticated route in this
  context does — see "Why every route is `/me`" below; the design.md draft
  of this change described a generic `:id`/`id`-argument shape, but this
  context's established confused-deputy-avoidance convention takes
  precedence). Validates the new model, no-ops on the same model, rejects
  with 409 if already `REEMBEDDING` for a genuinely different model,
  otherwise calls `aggregate.changeEmbeddingModel(...)`, saves, and
  publishes `KnowledgeBaseEmbeddingModelChangeRequestedEvent`.
- `ReembedKnowledgeBase` — auth required (`POST /knowledge-bases/me/reembed`,
  GraphQL mutation `reembedKnowledgeBase`, same `/me` resolution as every
  other authenticated route here). Forces a full re-embed of every document
  under the **current** embedding model — no model argument, unlike
  `ChangeKnowledgeBaseEmbeddingModel`. Exists for recovering from
  partial/corrupted embedding rows or provider-side drift without switching
  models. Rejects with 409 (`KnowledgeBaseReembeddingInProgressException`)
  if already `REEMBEDDING`; retryable from `FAILED`. Calls
  `aggregate.requestReembedding()`, saves, and publishes
  `KnowledgeBaseReembeddingRequestedEvent`.
- `CompleteKnowledgeBaseReembedding` — **internal only**, no transport
  surface. Dispatched exclusively by `embeddings`' re-embed processor (via
  `IKnowledgeBaseReembeddingStatusPort` on that side) on success. Sets
  `embeddingStatus = READY`.
- `FailKnowledgeBaseReembedding` — **internal only**, no transport surface.
  Dispatched exclusively by `embeddings`' re-embed processor on failure.
  Sets `embeddingStatus = FAILED`.

## Queries

- `KnowledgeBaseFindById` — exposed as the `knowledgeBase` GraphQL query and
  `GET /knowledge-bases/me` REST route. Always resolves the **caller's own**
  knowledge base — takes no `id` argument at the transport layer, only the
  `knowledgeBaseId` set by the guard. Its `KnowledgeBaseViewModel` includes
  `embeddingModel`/`embeddingStatus`; also consumed cross-context by
  `embeddings`' `IKnowledgeBaseEmbeddingConfigPort` adapter.
- `KnowledgeBaseFindByApiKeyHash` — **internal only**, no transport surface.
  Dispatched exclusively by `KnowledgeBaseApiKeyGuard` to resolve the
  `X-API-Key` header to a tenant.

## Cross-context: embedding model validation

```ts
export interface IEmbeddingModelValidationPort {
  isValid(modelId: string): Promise<boolean>;
}
```

Implemented by `infrastructure/adapters/embedding-model-validation.adapter.ts`,
dispatching `embeddings`' internal `EmbeddingModelExistsQuery` through the
global `QueryBus` — never a direct import of `embeddings`' module or domain
types outside `infrastructure/adapters/`. Used by both
`CreateKnowledgeBaseCommandHandler` and
`ChangeKnowledgeBaseEmbeddingModelCommandHandler`.

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

Table: `knowledge_bases` (migration `1780000000001-CreateKnowledgeBases`,
altered by `1780000000004-AddEmbeddingConfigToKnowledgeBases` to add
`embedding_model varchar(100) NOT NULL` and
`embedding_status varchar(20) NOT NULL DEFAULT 'READY'`; the migration
backfills any pre-existing rows with `'text-embedding-3-small'` — the
previous implicit global default — before making the column `NOT NULL`).
Unique index on `api_key_hash` — both a business invariant and the guard's
hot lookup path (runs on every authenticated request).
