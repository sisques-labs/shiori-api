# Proposal: Flexible embedding vector dimensions per Knowledge Base

## Why

`embeddings` hardcodes a single vector width for the whole service:
`EMBEDDING_VECTOR_DIMENSIONS = 1536` (OpenAI `text-embedding-3-small`'s
dimension) is baked into the `embeddings` table's pgvector column, the
`EmbeddingVectorValueObject`, and implicitly into `EMBEDDINGS_MODEL`
(whichever model an operator configures MUST produce 1536-dim vectors or
every embed call fails at the DB layer with a dimension mismatch). This is
already flagged as a known limitation in `src/contexts/embeddings/README.md`
and `openspec/changes/retrieval/design.md` (Open Questions), written before
`embeddings` even existed as its own context.

In practice this means every Knowledge Base in a given deployment is stuck
on one embedding model forever, chosen once via an env var. Swapping to a
better/cheaper/self-hosted model with a different dimension (e.g. Ollama's
`nomic-embed-text` at 768, or `text-embedding-3-large` at 3072) requires a
manual migration and re-embedding of the entire database — there is no
supported path for a single Knowledge Base to change models, and no way for
two Knowledge Bases in the same deployment to use different models at all.

## What Changes

- **Per-Knowledge-Base embedding model.** `KnowledgeBase` gains an
  `embeddingModel` field, set at creation and changeable later via a new
  command. The embedding model is no longer a global, instance-wide `.env`
  setting — `EMBEDDINGS_MODEL` is removed.
- **Static model registry.** `embeddings` owns a static, code-defined list
  of supported models (`id`, `provider`, `dimensions`) — the single source
  of truth for which models are selectable and what dimension each one
  produces. No live provider call is made to discover a model's dimension.
  A new public query lets clients list this registry (e.g. to populate a
  model picker when creating/updating a Knowledge Base).
- **Vector split into one physical table per dimension.** Because pgvector
  requires a fixed `vector(N)` column width, a single column can no longer
  serve every model. Rather than duplicating the whole `embeddings` row
  shape per dimension, only the `embedding` column moves out: the existing
  `embeddings` table keeps all metadata (`knowledge_base_id`, `document_id`,
  `chunk_id`, `chunk_text`, `chunk_position`, `model`, timestamps)
  unchanged, and a minimal new `embedding_vectors_{dimension}` table per
  distinct dimension in the registry (e.g. `embedding_vectors_768`,
  `embedding_vectors_1536`, `embedding_vectors_3072`) holds just the vector,
  linked 1:1 by a cascading foreign key. Two models that happen to share a
  dimension share a vector table (disambiguated by the existing `model`
  column on `embeddings`). Adding a model whose dimension isn't covered yet
  requires a new migration (a two-column table); this is an accepted,
  documented consequence of pgvector's fixed-width columns, not solved
  generically by this change.
- **Blocking model change with re-embedding.** Changing a Knowledge Base's
  `embeddingModel` moves it into a `REEMBEDDING` status. While in that
  status, `retrieval`/`embeddings` search is rejected for that Knowledge
  Base. A background job re-embeds every existing document's chunks under
  the new model into the new dimension's table, deletes the old vectors,
  and flips the Knowledge Base back to `READY`. No dual-serving of two
  model versions in this change (see Deferred below).
- **`IEmbeddingPort` takes an explicit model.** `embed`/`embedBatch` accept
  the model to call the provider with (resolved from the Knowledge Base),
  instead of always using one globally configured model.

**Deferred to future changes:**
- **Automatic dimension detection.** Discovering an unknown model's
  dimension by calling the provider's `/embeddings` endpoint once and
  measuring the returned vector. Not implemented now — it costs a real API
  call per registration and the static registry covers the models this
  service intends to support out of the box. Left as an Open Question below
  with a recommended approach for later.
- **Zero-downtime model cutover.** Serving searches against the old
  model/table while the new one re-embeds in the background, then
  atomically swapping. This change uses the simpler blocking approach
  (`REEMBEDDING` status rejects search) instead; the non-blocking version
  is recorded as future work.
- **Migrating pre-existing embeddings data.** There is no production data
  yet, so this change does not include a backfill/rollback path for
  existing rows in the old single-dimension `embeddings` table — the old
  table is dropped outright by the migration.

**Out of scope:**
- Any UI — API-only, matching every prior context in this service.
- Hybrid search, re-ranking, multi-vector-per-chunk (unrelated to this
  change, still single dense-vector cosine search).

## Capabilities

### Changed Capabilities

- `knowledge-bases`: a Knowledge Base now carries an `embeddingModel` and an
  `embeddingStatus` (`READY | REEMBEDDING | FAILED`); a new command changes
  the model and triggers re-embedding.
- `embeddings`: vector storage moves from one fixed-dimension table to a
  table-per-dimension scheme, resolved per Knowledge Base at write/search
  time; gains a public "list available models" query; `IEmbeddingPort` gains
  an explicit `model` parameter; gains a re-embed-on-model-change pipeline.

## Impact

| Area | Impact |
|------|--------|
| `src/contexts/knowledge-bases/` | Modify — `embeddingModel`/`embeddingStatus` fields, value objects, new `ChangeKnowledgeBaseEmbeddingModel` command, internal completion/failure commands, cross-context validation port |
| `src/contexts/embeddings/` | Modify — model registry, table-per-dimension persistence + routing, new public `EmbeddingAvailableModels` query, `IEmbeddingPort` signature change, re-embed pipeline, new cross-context listener for model-change events |
| `src/contexts/retrieval/` | Modify — reject search while the target Knowledge Base is `REEMBEDDING` |
| `src/contexts/documents/` | Modify — expose an internal query to list all chunks for a Knowledge Base (not just per document), needed by the re-embed pipeline |
| `src/database/migrations/` | New — add `embedding_model`/`embedding_status` to `knowledge_bases`; drop the `embedding` column from `embeddings` (metadata table otherwise unchanged); create `embedding_vectors_{dimension}` tables for every dimension in the initial registry |
| `.env.example` | Modify — remove `EMBEDDINGS_MODEL` (now per-Knowledge-Base, not global); keep `EMBEDDINGS_BASE_URL`/`EMBEDDINGS_API_KEY` |

## Rollback Plan

Migrations are additive/destructive in a dev-only context (no production
data to preserve, per explicit decision): the `down()` of the new migrations
recreates the old single `embeddings` table and drops the per-dimension
ones, and drops the two new `knowledge_bases` columns. The command/query
additions are backward-incompatible for `CreateKnowledgeBase` (now requires
`embeddingModel`) — this is accepted since there is no external consumer
yet. If this change needs to be reverted post-merge, the previous fixed
1536-dimension behavior can be restored by reverting these commits plus the
migrations' `down()`.

## Open Questions

- [ ] **Automatic dimension detection.** Recommendation: a future change
  adds an optional "probe" path — when registering a model not in the
  static registry, call `embed()` once with a short fixed string and store
  the resulting vector's length as the dimension. Gate it behind an explicit
  opt-in (e.g. an admin-only "register custom model" command) so it's never
  triggered implicitly on every embed call. Not implemented here because it
  adds a real provider cost and an unregistered-model failure mode that the
  static registry avoids entirely for the MVP.
- [ ] **Zero-downtime cutover.** Recommendation: a future change keeps the
  Knowledge Base servable under the *old* model/table while the new one
  re-embeds in a shadow table, then does a single atomic pointer swap
  (update `embeddingModel`/`embeddingStatus` in one transaction) once the
  new table's row count matches the source chunk count. Requires tracking
  "current" vs. "pending" model on the Knowledge Base simultaneously, which
  the blocking approach in this change avoids needing.
- [ ] **Partial re-embed retry.** If a re-embed job fails partway (some
  documents already written into the new dimension's table), does a retry
  (`ChangeKnowledgeBaseEmbeddingModel` called again) need to clear those
  partial rows first, or is per-document overwrite-on-retry sufficient?
  Recommendation: `ReembedKnowledgeBaseProcessor` deletes the Knowledge
  Base's rows from the *target* dimension's table before starting each
  attempt (cheap, table is scoped to `knowledge_base_id` already), so every
  attempt is a clean rewrite regardless of how a prior one failed.
- [ ] **New document ingested during an in-flight re-embed.** A document
  chunked *after* `ReembedKnowledgeBaseProcessor` has already enumerated
  the Knowledge Base's document ids won't be picked up by that re-embed
  run, even though it correctly embeds under the new model via the normal
  pipeline. Recommendation: acceptable for this change (never produces a
  wrong-dimension search result, only a possible gap that a second
  `ChangeKnowledgeBaseEmbeddingModel` call — itself now a clean-retry
  operation per the point above — would close). A future change could
  close the window generically by re-enumerating documents once more right
  before the final `deleteByKnowledgeBaseId` cutover.
