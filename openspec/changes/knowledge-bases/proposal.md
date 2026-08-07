# Proposal: KnowledgeBase bounded context

## Why

Shiori is a service template with zero bounded contexts (`src/contexts/` is
empty). Its stated roadmap is document ingestion, chunking/embedding, vector
retrieval, and generation — but every one of those future contexts needs
something that doesn't exist yet: a tenant. Without a tenant root, `documents`
and `retrieval` have no unit of isolation to scope their data to, and no
credential to authenticate a caller against.

`knowledge-bases` is that tenant root. It is deliberately the *first* bounded
context added to this template, so the tenancy mechanism it introduces
(API-key resolution → `AsyncLocalStorage` request context → auto-scoped
repositories) becomes the pattern every subsequent context reuses, the same
way `spaces` established tenancy for `gardenia-api` (same template, sibling
service).

## What Changes

- New **`knowledge-bases`** bounded context with a `KnowledgeBaseAggregate`
  (`id`, `name`, `description?`, `apiKeyHash`).
- Commands: `CreateKnowledgeBase` (generates and returns the API key in
  plaintext **once**, persists only its SHA-256 hash), `UpdateKnowledgeBase`,
  `DeleteKnowledgeBase`, `RotateKnowledgeBaseApiKey` (invalidates the previous
  key, issues a new one).
- Query: `KnowledgeBaseFindById` — resolves the caller's own knowledge base
  (id comes from the authenticated request, never from client input).
- New cross-cutting **tenancy mechanism** in `src/core/tenancy/`:
  `KnowledgeBaseContext` (`AsyncLocalStorage`-backed, mirrors gardenia-api's
  `SpaceContext`), `createTenantRepository()` (TypeORM `Repository<E>` proxy
  that auto-injects `knowledgeBaseId` into `find`/`save`/`delete`), and
  `KnowledgeBaseContextInterceptor` (opens the ALS frame for the request
  lifecycle). Registered globally via a `@Global()` `TenancyModule`.
- `KnowledgeBaseApiKeyGuard` in the context's own `infrastructure/guards/`:
  resolves the `X-API-Key` header to a knowledge base via
  `KnowledgeBaseFindByApiKeyHashQuery` (an internal-only query, no transport
  surface) and sets `req.knowledgeBaseId`.
- REST (`api/knowledge-bases`) + GraphQL transport. **No MCP tools** — see
  Deviation 2 below.
- Domain event `KnowledgeBaseDeleted` is modeled now (per `AGENTS.md`'s
  "every command handler MUST log on completion" + event-driven cascade
  convention) even though no consumer exists yet — `documents`/`retrieval`
  will listen to it when they're proposed.

### Deviations from the pre-proposal debate (flag for review)

This proposal intentionally departs from two things settled earlier in
conversation, because working through the auth model in detail surfaced
problems with them. Both are also called out in `design.md` §Architecture
Decisions.

1. **No `KnowledgeBaseFindByCriteria` / list query.** Every knowledge base
   authenticates as itself via its own API key — there is no admin/root
   identity in this MVP that is authorized to see *other* tenants. A
   `findByCriteria` here would either be pointless (always returns 0 or 1
   result — the caller itself) or a cross-tenant data-leak vector if ever
   miswired. `openspec/config.yaml` marks the Criteria pattern "mandatory for
   every context, no exception" — this context is the deliberate exception,
   with the rationale above. Revisit if a future admin/root auth layer is
   added.
2. **No MCP tools for this context.** `AGENTS.md` explicitly says: "Do NOT
   expose credential/session or PII-sensitive contexts without an explicit
   decision." Every command here either issues or rotates a credential
   (`CreateKnowledgeBase`, `RotateKnowledgeBaseApiKey`) or mutates the tenant
   record itself. Exposing knowledge-base lifecycle management to an
   AI-driven MCP caller is exactly the case that rule exists for.

**Deferred to future changes:**
- `documents` and `retrieval` contexts themselves (separate proposals).
- Generation/chat.
- Multiple simultaneous active API keys per knowledge base (rotation today
  invalidates the old key immediately — no overlap window).
- Any notion of an owning user/account above a knowledge base (Shiori has no
  user/session concept in the MVP — the API key *is* the identity).
- A global admin/bootstrap secret gating `CreateKnowledgeBase` itself (see
  Open Questions in `design.md` — right now the create endpoint is
  intentionally unauthenticated, like a signup).

**Out of scope:**
- pgvector extension setup, Redis/BullMQ wiring — these belong to the
  `documents`/`retrieval` changes that actually need them, not this one.

## Capabilities

### New Capabilities

- `knowledge-bases`: tenant CRUD (create/update/delete/rotate key), dual
  transport (REST + GraphQL), API-key authentication and request-scoped
  tenant context usable by future contexts.

## Impact

| Area | Impact |
|------|--------|
| `src/contexts/knowledge-bases/` | New — full bounded context (~55 files) |
| `src/core/tenancy/` | New — `KnowledgeBaseContext`, `createTenantRepository`, `KnowledgeBaseContextInterceptor`, `TenancyModule` |
| `src/core/core.module.ts` | Modify — register `TenancyModule` in `CORE_MODULES` |
| `src/contexts/contexts.module.ts` | Modify — register `KnowledgeBasesModule` in `CONTEXT_MODULES` |
| `src/database/migrations/1780000000001-CreateKnowledgeBases.ts` | New — `knowledge_bases` table (first migration in this service) |
| `.env.example` | Modify — document `API_KEY_HASH_ALGORITHM` if made configurable (see Open Questions) |

## Rollback Plan

The migration is additive — `down()` drops `knowledge_bases`. `TenancyModule`
and `KnowledgeBasesModule` can both be unregistered from their respective
module arrays independently; nothing else in the app depends on them yet
since no other context exists. No data migration/backfill risk.
