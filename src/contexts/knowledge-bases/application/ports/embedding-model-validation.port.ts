export const EMBEDDING_MODEL_VALIDATION_PORT = Symbol(
  'EMBEDDING_MODEL_VALIDATION_PORT',
);

/**
 * Hexagonal seam over `embeddings`. Implemented by
 * `infrastructure/adapters/embedding-model-validation.adapter.ts`, which
 * dispatches `embeddings`' internal `EmbeddingModelExistsQuery` through the
 * global QueryBus — `knowledge-bases` never imports `embeddings`' module or
 * domain types directly, it only knows "is this model id valid".
 */
export interface IEmbeddingModelValidationPort {
  isValid(modelId: string): Promise<boolean>;
}
