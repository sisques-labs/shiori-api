export const EMBEDDING_PORT = Symbol('EMBEDDING_PORT');

/**
 * Hexagonal seam for turning text into a vector. Default implementation
 * calls an OpenAI-compatible embeddings endpoint; the seam allows swapping
 * in a different provider without touching the pipeline or search query.
 */
export interface IEmbeddingPort {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
