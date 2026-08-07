export interface EmbeddingSearchQueryInput {
  text: string;
  topK: number;
}

/**
 * Internal-only — no transport surface. This is `embeddings`' public
 * cross-context capability: turn free text into a vector and run the
 * tenant-scoped similarity search in one call, so `retrieval` (and any
 * future consumer) never needs to know embeddings are involved.
 */
export class EmbeddingSearchQuery {
  public readonly text: string;
  public readonly topK: number;

  constructor(input: EmbeddingSearchQueryInput) {
    this.text = input.text;
    this.topK = input.topK;
  }
}
