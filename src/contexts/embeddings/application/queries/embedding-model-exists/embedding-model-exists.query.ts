export interface EmbeddingModelExistsQueryInput {
  modelId: string;
}

/**
 * Internal only — no transport surface. Dispatched exclusively by
 * `knowledge-bases`' `IEmbeddingModelValidationPort` adapter via the global
 * QueryBus.
 */
export class EmbeddingModelExistsQuery {
  public readonly modelId: string;

  constructor(input: EmbeddingModelExistsQueryInput) {
    this.modelId = input.modelId;
  }
}
