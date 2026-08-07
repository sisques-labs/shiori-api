# Spec Delta: `embeddings` — change `flexible-embedding-dimensions`

## 1. Domain Model

### 1.1 EmbeddingModelDefinition (new, static)

`EMBEDDING_MODELS_REGISTRY: readonly EmbeddingModelDefinition[]` — code
constant, not persisted. `{ id: string; provider: string; dimensions: number }`.
Initial entries: `text-embedding-3-small` (1536, openai),
`text-embedding-3-large` (3072, openai), `text-embedding-ada-002` (1536,
openai), `nomic-embed-text` (768, ollama), `mxbai-embed-large` (1024,
ollama).

`EMBEDDING_VECTOR_DIMENSIONS` (old single global constant) is REMOVED.

### 1.2 EmbeddingModelRegistryService (new, domain, no I/O)

```ts
findById(modelId: string): EmbeddingModelDefinition | null
getOrThrow(modelId: string): EmbeddingModelDefinition  // throws UnknownEmbeddingModelException
listAll(): readonly EmbeddingModelDefinition[]
```

### 1.3 EmbeddingAggregate (unchanged shape)

Same fields as before (`id`, `knowledgeBaseId`, `documentId`, `chunkId`,
`chunkText`, `chunkPosition`, `embedding`, `model`, `createdAt`). The
`embedding` value object's length is no longer fixed at construction time
via a shared constant — callers MUST know and pass the correct dimension
for the Knowledge Base's current model (enforced by the routing repository,
not the aggregate itself).

## 2. Public Queries (new transport surface)

This context previously had none. It now exposes exactly one, non-tenant,
non-guarded:

### 2.1 EmbeddingAvailableModels (public)

**Path:** `GET /embeddings/models` · GraphQL `embeddingModels`.

**Rules:** No input. Returns `EMBEDDING_MODELS_REGISTRY` verbatim
(`{ id, provider, dimensions }[]`). No guard — static, non-sensitive
configuration data, not tenant-scoped.

### 2.2 EmbeddingModelExists (internal only, no transport)

**Inputs:** `modelId: string`. Returns `boolean`. Dispatched by
`knowledge-bases`' `IEmbeddingModelValidationPort` adapter via `QueryBus`.

## 3. Cross-context: Knowledge Base embedding config

### 3.1 IKnowledgeBaseEmbeddingConfigPort

```ts
export interface IKnowledgeBaseEmbeddingConfig {
  embeddingModel: string;
  embeddingStatus: 'READY' | 'REEMBEDDING' | 'FAILED';
}
export interface IKnowledgeBaseEmbeddingConfigPort {
  getByKnowledgeBaseId(knowledgeBaseId: string): Promise<IKnowledgeBaseEmbeddingConfig>;
}
```

Implemented in `infrastructure/adapters/knowledge-base-embedding-config.adapter.ts`,
dispatching `knowledge-bases`' `KnowledgeBaseFindByIdQuery` (extended with
`embeddingModel`/`embeddingStatus`) via `QueryBus`.

Every embed/search entry point MUST resolve this first and derive
`dimensions` via `EmbeddingModelRegistryService.getOrThrow(config.embeddingModel).dimensions`
before touching any `embeddings_{dimension}` table.

## 4. Persistence — table-per-dimension

### 4.1 Schema

One table per distinct `dimensions` value in the registry:
`embeddings_768`, `embeddings_1024`, `embeddings_1536`, `embeddings_3072`
(initial set). Same columns as the previous single `embeddings` table.
Replaces it entirely — the old `embeddings` table is dropped by migration
(no production data to preserve).

### 4.2 Repository interfaces (modified — dimension-parameterized)

```ts
export interface IEmbeddingWriteRepository {
  saveMany(embeddings: EmbeddingAggregate[], dimensions: number): Promise<void>;
  deleteByDocumentId(documentId: string, dimensions: number): Promise<void>;
  deleteByKnowledgeBaseId(knowledgeBaseId: string, dimensions: number): Promise<void>;
}

export interface IEmbeddingReadRepository {
  search(vector: number[], topK: number, dimensions: number): Promise<IEmbeddingSearchResult[]>;
}
```

TypeORM implementations route to the `Repository<...>` matching the given
`dimensions`, built from one generated entity class per registry
dimension (`createEmbeddingTypeOrmEntity(dimensions)`). An unregistered
dimension (should be unreachable if the registry and the migrated tables
are kept in sync) throws `NoEmbeddingTableForDimensionException`.

## 5. Embedding pipeline (modified)

### 5.1 EmbedDocumentChunks (internal, modified)

Processor MUST, before embedding:
1. Resolve `IKnowledgeBaseEmbeddingConfigPort.getByKnowledgeBaseId(knowledgeBaseId)`.
2. Resolve `dimensions` from the registry for `config.embeddingModel`.
3. Call `IEmbeddingPort.embedBatch(texts, config.embeddingModel)` — model
   explicit, no longer implicit from a global config.
4. `saveMany(..., dimensions)`.

This step runs regardless of the Knowledge Base's `embeddingStatus` — a
document's normal chunk→embed flow is independent of another,
possibly-concurrent, model-change re-embed for the same Knowledge Base;
see Scenario SC-07 for the one exception this creates.

### 5.2 ReembedKnowledgeBase (new, internal, no transport)

Triggered by `KnowledgeBaseEmbeddingModelChangedListener`
(`@EventsHandler(KnowledgeBaseEmbeddingModelChangeRequestedEvent)` from
`@contexts/knowledge-bases/`), which enqueues a job via
`IEmbeddingReembedQueuePort.enqueueReembed(knowledgeBaseId, previousModel, newModel)`
onto the existing `embeddings` BullMQ queue.

`ReembedKnowledgeBaseProcessor` MUST, inside its own
`KnowledgeBaseContext.run(knowledgeBaseId, ...)` frame:
1. Enumerate every document id for the Knowledge Base via
   `IChunkSourcePort.findKnowledgeBaseDocumentIds(knowledgeBaseId)` (new
   port method, backed by a new internal `documents` query).
2. For each document: fetch its chunks, embed them with `newModel`, save
   into the new dimension's table.
3. Only after every document succeeds: delete all of that Knowledge
   Base's embeddings from the *previous* dimension's table
   (`deleteByKnowledgeBaseId(knowledgeBaseId, previousDimensions)`).
4. On full success: dispatch `CompleteKnowledgeBaseReembeddingCommand`.
5. On any failure: dispatch `FailKnowledgeBaseReembeddingCommand` with the
   error reason. MUST NOT delete the previous dimension's data in this
   path — the Knowledge Base stays searchable-again-if-reverted (though
   search itself stays blocked while `FAILED`, per `knowledge-bases`'
   spec — this only affects the safety of the retry path).

### 5.3 IEmbeddingPort (modified signature)

```ts
export interface IEmbeddingPort {
  embed(text: string, model: string): Promise<number[]>;
  embedBatch(texts: string[], model: string): Promise<number[][]>;
}
```

`OpenAiCompatibleEmbeddingService` sends the given `model` in the request
body instead of a config-injected constant. `EmbeddingsConfig` drops
`embeddingModel`; `EMBEDDINGS_MODEL` env var is removed.

## 6. Search (modified)

### 6.1 EmbeddingSearch (internal, dispatched by `retrieval`)

MUST, before embedding the query text:
1. Resolve `IKnowledgeBaseEmbeddingConfigPort.getByKnowledgeBaseId(knowledgeBaseId)`.
2. If `config.embeddingStatus !== 'READY'`: throw
   `KnowledgeBaseNotReadyForSearchException` (surfaced by `retrieval` as
   HTTP 409).
3. Otherwise resolve `dimensions`, call
   `IEmbeddingPort.embed(query.text, config.embeddingModel)`, then
   `IEmbeddingReadRepository.search(vector, topK, dimensions)`.

## 7. Cross-context (new/modified adapters)

| Port | Direction | Backed by |
|------|-----------|-----------|
| `IKnowledgeBaseEmbeddingConfigPort` | `embeddings` → `knowledge-bases` | `KnowledgeBaseFindByIdQuery` (extended) via `QueryBus` |
| `IChunkSourcePort.findKnowledgeBaseDocumentIds` | `embeddings` → `documents` | New internal `DocumentFindIdsByKnowledgeBaseIdQuery` via `QueryBus` |
| `IEmbeddingModelValidationPort` (consumer-side, defined in `knowledge-bases`) | `knowledge-bases` → `embeddings` | New internal `EmbeddingModelExistsQuery` via `QueryBus` |

## 8. Scenarios

### SC-01 List available models
**Given** the static registry has 5 entries
**When** `GET /embeddings/models`
**Then** HTTP 200, all 5 returned with `id`/`provider`/`dimensions`, no
guard/auth required.

### SC-02 Embed pipeline uses the Knowledge Base's own model
**Given** KB1 configured with `nomic-embed-text` (768) and KB2 with
`text-embedding-3-small` (1536)
**When** each ingests a document and the embed pipeline runs
**Then** KB1's vectors land in `embeddings_768` with `model = 'nomic-embed-text'`,
KB2's land in `embeddings_1536` with `model = 'text-embedding-3-small'`.

### SC-03 Search blocked during re-embedding
**Given** a Knowledge Base with `embeddingStatus = REEMBEDDING`
**When** a search is attempted for that Knowledge Base
**Then** HTTP 409, no provider call made, no table read.

### SC-04 Re-embed moves all documents to the new table
**Given** a Knowledge Base with 3 documents embedded under
`text-embedding-3-small` (1536), then changed to `nomic-embed-text` (768)
**When** the re-embed job completes
**Then** `embeddings_768` has one row per chunk across all 3 documents with
`model = 'nomic-embed-text'`, and `embeddings_1536` has zero rows for that
Knowledge Base.

### SC-05 Re-embed failure leaves the old table intact
**Given** a re-embed job that fails partway (e.g. provider error on
document 2 of 3)
**When** the failure is handled
**Then** `FailKnowledgeBaseReembeddingCommand` is dispatched,
`embeddings_1536` (the previous dimension) still has all of the Knowledge
Base's original rows untouched, and `embeddings_768` has only whatever
partial rows were written before the failure (see proposal.md's Open
Questions — "Partial re-embed retry" — for whether a retry needs to clear
these first).

### SC-06 Two Knowledge Bases with the same dimension share a table safely
**Given** KB1 on `text-embedding-3-small` and KB2 on `text-embedding-ada-002`
(both 1536)
**When** both are searched
**Then** each only ever sees its own `knowledge_base_id`'s rows in
`embeddings_1536` — the existing tenant-scoping guarantee, unaffected by
sharing a table across models.

### SC-07 Normal ingestion during a concurrent re-embed
**Given** a Knowledge Base in `REEMBEDDING` (model change in progress) that
also receives a brand-new document via the normal ingestion pipeline
**When** the new document finishes chunking and its embed job runs
**Then** it embeds under the Knowledge Base's *current* `embeddingModel`
(the new one, already flipped at request time) — no special-casing needed,
but note this document's chunks will NOT be picked up by the in-flight
re-embed job if it already passed the document-enumeration step (§5.2.1);
flagged as a known race in proposal.md's Open Questions ("New document
during re-embed"), acceptable for this change since it can only
under-embed (never search a wrong-dimension vector), and a second
`ChangeKnowledgeBaseEmbeddingModel` call is always a safe retry.
