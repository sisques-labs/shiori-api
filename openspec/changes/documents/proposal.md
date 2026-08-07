# Proposal: Document bounded context

## Why

`knowledge-bases` (merging soon) gives Shiori a tenant root and an API key
per tenant, but there is still nothing to put *in* a knowledge base. This
change adds document ingestion and chunking — the first half of the RAG
pipeline (ingest → chunk → **embed → retrieve**, the second half is
`retrieval`, proposed separately). Without this, Shiori is tenancy with
nothing to be tenant of.

## What Changes

- New tenant-scoped **`documents`** bounded context with a `DocumentAggregate`
  (raw text/Markdown content, lifecycle status) and a `ChunkAggregate`
  (the pieces `retrieval` will embed later).
- Commands: `CreateDocument`, `UpdateDocument` (replaces content, re-chunks),
  `DeleteDocument` (cascades to chunks).
- Queries: `DocumentFindById`, `DocumentFindByCriteria` (list within the
  caller's own knowledge base — a normal, non-deviant use of the mandatory
  Criteria pattern, unlike `knowledge-bases`' deliberate omission: here
  there genuinely are many documents per authenticated tenant).
- Async chunking pipeline: `CreateDocument`/`UpdateDocument` persist the
  document as `PENDING` and enqueue a BullMQ job (`documents` queue, wired
  onto the shared Redis connection added in the previous commit); a
  processor runs the chunking algorithm and transitions the document to
  `CHUNKED` or `FAILED`.
- Chunking strategy behind a port (`ChunkingStrategyPort`) — default
  adapter is paragraph-first recursive splitting (~1000 chars, ~15%
  overlap), so a token-aware or semantic strategy can replace it later
  without touching the pipeline.
- Guardrails: max content length and max chunks per document, both
  configurable via env vars, enforced before/during chunking.
- REST + GraphQL + **MCP tools** (unlike `knowledge-bases`, nothing here is
  credential-adjacent — ingesting and listing documents is exactly the
  AI-callable surface MCP exists for).
- Reuses `knowledge-bases`' tenancy seam: `createTenantRepository` gets its
  first real consumer here; `KnowledgeBaseApiKeyGuard` (now in
  `src/core/tenancy/`, moved during the `knowledge-bases` PR specifically
  because a second consumer proved it needed to be cross-cutting) guards
  every route.
- `DocumentDeleted` event, plus `KnowledgeBaseDeleted` is now actually
  consumed: a listener in this context deletes all of a knowledge base's
  documents/chunks when its knowledge base is deleted (the cascade hook
  `knowledge-bases`' design.md flagged as future work).

**Deferred to future changes:**
- Embeddings, vector storage, semantic search — all `retrieval` (proposed
  next, stacked on this branch).
- PDF/HTML/other document types — plain text/Markdown only, per the earlier
  MVP debate.
- Configurable chunking strategy per knowledge base (single strategy,
  globally configured, for the MVP).
- Real-time ingestion status push (webhook/subscription) — status is only
  visible by polling `DocumentFindById`, per the earlier debate's decision
  to keep this minimal.

**Out of scope:**
- Generation/chat (still `retrieval`+future context territory).
- Document versioning/history (update replaces content in place).

## Capabilities

### New Capabilities

- `documents`: tenant-scoped document CRUD with async chunking, dual
  transport (REST + GraphQL) + MCP tools, cascade-deletes on knowledge base
  deletion.

## Impact

| Area | Impact |
|------|--------|
| `src/contexts/documents/` | New — full bounded context |
| `src/database/migrations/1780000000002-CreateDocuments.ts` | New — `documents` + `chunks` tables |
| `src/contexts/contexts.module.ts` | Modify — register `DocumentsModule` |
| `.env.example` | Modify — document `REDIS_*`, `DOCUMENTS_MAX_CONTENT_LENGTH`, `DOCUMENTS_MAX_CHUNKS` |

## Rollback Plan

The migration is additive — `down()` drops `chunks` then `documents`
(FK order). `DocumentsModule` can be unregistered from
`contexts.module.ts` independently; `knowledge-bases` has zero compile-time
dependency on `documents` (the `KnowledgeBaseDeleted` listener lives in
*this* context, consuming an event `knowledge-bases` already emits — removing
`documents` removes the listener, not the event). The BullMQ queue is
additive infra with no consumers if this context is removed.
