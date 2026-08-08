export const EMBEDDING_PORT = Symbol('EMBEDDING_PORT');

/**
 * Hexagonal seam for turning text into a vector. Default implementation
 * calls an OpenAI-compatible embeddings endpoint; the seam allows swapping
 * in a different provider without touching the pipeline or search query.
 *
 * `model` is explicit on every call — every caller already resolves a
 * per-Knowledge-Base model before calling anyway (to also resolve the
 * vector table dimension), so there is no implicit/global fallback model.
 */
export interface IEmbeddingPort {
  embed(text: string, model: string): Promise<number[]>;
  embedBatch(texts: string[], model: string): Promise<number[][]>;
}
