# `retrieval`

Tenant-scoped semantic search over `documents`' chunks — the last of the
MVP bounded contexts. This context owns query orchestration and transport
only; embedding generation, storage, and the pgvector similarity search
itself live in the sibling `embeddings` context (split out from what used
to be a single `retrieval` context — see `embeddings/README.md`).

## No aggregate

This context has no domain layer of its own — no aggregate, no
repository, no persistence. Its only job is to turn an incoming search
request into a call to `embeddings` and shape the response.

## Query

`RetrievalSearch` — the only public surface this context exposes.
Delegates to `embeddings` via `EmbeddingSearchPort`, then returns ranked
chunks. REST (`POST /retrieval/search`), GraphQL (`retrievalSearch`), and
an MCP tool (`retrieval_search`) — this context's entire purpose is to be
AI-callable, so nothing here is held back from MCP (contrast with
`knowledge-bases`, which has none by design).

```
RetrievalSearchQueryHandler.execute(query)
  ├─ resolve topK: clamp(query.topK ?? searchTopKDefault, max: searchTopKMax)
  └─ EmbeddingSearchPort.search(query.query, topK)   — via embeddings' QueryBus
```

If the target Knowledge Base's `embeddingStatus` is `REEMBEDDING` or
`FAILED`, `embeddings`' own `EmbeddingSearchQueryHandler` rejects with
`EmbeddingSearchNotReadyException` before this context ever sees a
result — surfaced here as HTTP 409 by the global exception filter (mapped
in `embeddings`' own `embeddings-exception.filter.ts`, since the exception
is thrown from that context and propagates unchanged; `retrieval` needs no
exception filter of its own for this).

## Cross-context search capability

`retrieval` never touches embedding data or generation directly. There is
no cross-context module import here — `embeddings` exposes an
internal-only `EmbeddingSearchQuery` (no transport surface: embeds the
text and runs the similarity search in one call), and this context's
`EmbeddingSearchAdapter` (`infrastructure/adapters/` — the
ESLint-permitted seam) dispatches it through the global `QueryBus`. This
is the established cross-context pattern in this codebase (mirrored from
the sibling `gardenia-api` service's `CareLogAdapter`): a context's own
`.module.ts` can never import another context's module (ESLint's
`boundaries/element-types` rule would reject it), so cross-context reads
always go through a dispatched Command/Query class instead of an injected
repository token.

## Guardrail env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `RETRIEVAL_SEARCH_TOP_K_DEFAULT` | 5 | Results returned when `topK` is omitted |
| `RETRIEVAL_SEARCH_TOP_K_MAX` | 20 | Hard cap on `topK`, regardless of what a caller requests |

Embedding-generation env vars (`EMBEDDINGS_BASE_URL`, `EMBEDDINGS_API_KEY`)
live in `embeddings`, not here — there is no `EMBEDDINGS_MODEL` var, since
the model is a per-Knowledge-Base setting (see `embeddings/README.md` and
`knowledge-bases/README.md`).
