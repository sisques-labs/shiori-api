# Spec Delta: `knowledge-bases` — change `flexible-embedding-dimensions`

## 1. Domain Model

### 1.1 KnowledgeBaseAggregate (modified)

New fields:

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `embeddingModel` | string | No | Free-form model id, validated against `embeddings`' registry at the application layer (not by the value object itself — the aggregate has no cross-context knowledge of which ids are valid) |
| `embeddingStatus` | enum (`READY`\|`REEMBEDDING`\|`FAILED`) | No | Defaults to `READY` on creation |

New instance method:

```ts
changeEmbeddingModel(newModel: KnowledgeBaseEmbeddingModelValueObject): void
```

MUST:
- No-op (no event, no state change) if `newModel` equals the current
  `embeddingModel`.
- Set `embeddingStatus = REEMBEDDING` and `embeddingModel = newModel`
  otherwise, then apply `KnowledgeBaseEmbeddingModelChangeRequestedEvent`
  with `{ knowledgeBaseId, previousModel, newModel }`.

New internal-only mutators (no public command wraps them directly except
via the two internal commands below):

```ts
completeReembedding(): void   // embeddingStatus = READY
failReembedding(reason: string): void   // embeddingStatus = FAILED
```

## 2. Commands

### 2.1 CreateKnowledgeBase (modified)

**New required input field:** `embeddingModel: string`.

**Rules:**
- MUST validate `embeddingModel` against `embeddings`' model registry via
  `IEmbeddingModelValidationPort` before constructing the aggregate.
  Unknown model → `InvalidEmbeddingModelException` (400).
- New Knowledge Bases are created with `embeddingStatus = READY`.

### 2.2 ChangeKnowledgeBaseEmbeddingModel (new, public)

**Path:** `PATCH /knowledge-bases/:id/embedding-model` · GraphQL mutation
`changeKnowledgeBaseEmbeddingModel(id, embeddingModel)`.

**Inputs:** `id` (UUID), `embeddingModel` (string).

**Rules:**
- MUST 404 if the Knowledge Base doesn't exist (existing `assertExists`
  pattern).
- MUST validate `embeddingModel` against the registry; unknown model →
  `InvalidEmbeddingModelException` (400).
- MUST reject with `KnowledgeBaseReembeddingInProgressException` (409) if
  `embeddingStatus === REEMBEDDING` already.
- MUST no-op (200, no side effects) if `embeddingModel` equals the current
  value.
- Otherwise MUST call `aggregate.changeEmbeddingModel(...)`, save, and
  publish `KnowledgeBaseEmbeddingModelChangeRequestedEvent`.

### 2.3 CompleteKnowledgeBaseReembedding (new, internal only)

**Inputs:** `knowledgeBaseId`. Dispatched only by `embeddings`' re-embed
processor on success (via `CommandBus`, no transport surface). Sets
`embeddingStatus = READY`.

### 2.4 FailKnowledgeBaseReembedding (new, internal only)

**Inputs:** `knowledgeBaseId`, `reason`. Dispatched only by `embeddings`'
re-embed processor on failure. Sets `embeddingStatus = FAILED`. A
`FAILED` Knowledge Base can be retried by calling
`ChangeKnowledgeBaseEmbeddingModel` again.

## 3. Queries

### 3.1 KnowledgeBaseFindById (modified)

`KnowledgeBaseViewModel` gains `embeddingModel` and `embeddingStatus`.
Consumed cross-context by `embeddings` (see its spec delta,
"Cross-context: Knowledge Base embedding config").

## 4. Cross-context

### 4.1 Model validation: IEmbeddingModelValidationPort

```ts
export interface IEmbeddingModelValidationPort {
  isValid(modelId: string): Promise<boolean>;
}
```

Implemented in `infrastructure/adapters/embedding-model-validation.adapter.ts`,
dispatching `embeddings`' internal `EmbeddingModelExistsQuery` via the
global `QueryBus` — the established cross-context read pattern in this
codebase (no direct module import).

### 4.2 Event: KnowledgeBaseEmbeddingModelChangeRequested

```ts
// src/contexts/knowledge-bases/domain/events/knowledge-base-embedding-model-change-requested/
export class KnowledgeBaseEmbeddingModelChangeRequestedEvent extends BaseDomainEvent<{
  knowledgeBaseId: string;
  previousModel: string;
  newModel: string;
}> {}
```

Consumed by `embeddings`' `KnowledgeBaseEmbeddingModelChangedListener`.

## 5. Scenarios

### SC-01 Create requires a valid model
**Given** a `CreateKnowledgeBase` request with `embeddingModel: "not-a-real-model"`
**When** submitted
**Then** HTTP 400, no Knowledge Base created.

### SC-02 Create with a valid model
**Given** `embeddingModel: "text-embedding-3-small"` (present in the registry)
**When** submitted
**Then** HTTP 201, `embeddingStatus = READY`.

### SC-03 Change model triggers re-embedding
**Given** a `READY` Knowledge Base on `text-embedding-3-small`
**When** `ChangeKnowledgeBaseEmbeddingModel` is called with `nomic-embed-text`
**Then** `embeddingStatus` becomes `REEMBEDDING` immediately,
`KnowledgeBaseEmbeddingModelChangeRequestedEvent` is published with both
model ids.

### SC-04 Change model — same model is a no-op
**Given** a Knowledge Base already on `text-embedding-3-small`
**When** `ChangeKnowledgeBaseEmbeddingModel` is called with
`text-embedding-3-small`
**Then** HTTP 200, no event published, `embeddingStatus` unchanged.

### SC-05 Change model — rejected while already re-embedding
**Given** a Knowledge Base with `embeddingStatus = REEMBEDDING`
**When** `ChangeKnowledgeBaseEmbeddingModel` is called again with any model
**Then** HTTP 409, no state change.

### SC-06 Re-embedding completes
**Given** a Knowledge Base in `REEMBEDDING`
**When** `embeddings` dispatches `CompleteKnowledgeBaseReembedding`
**Then** `embeddingStatus` becomes `READY`.

### SC-07 Re-embedding fails
**Given** a Knowledge Base in `REEMBEDDING`
**When** `embeddings` dispatches `FailKnowledgeBaseReembedding`
**Then** `embeddingStatus` becomes `FAILED`, and a subsequent
`ChangeKnowledgeBaseEmbeddingModel` call is accepted (retry path).
