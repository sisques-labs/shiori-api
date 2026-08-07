export const EMBEDDING_SEARCH_PORT = Symbol('EMBEDDING_SEARCH_PORT');

export interface IRetrievalSearchResult {
  chunkId: string;
  documentId: string;
  chunkText: string;
  chunkPosition: number;
  score: number;
}

/**
 * Hexagonal seam over `embeddings`. Implemented by
 * `infrastructure/adapters/embedding-search.adapter.ts`, which dispatches
 * `embeddings`' internal-only `EmbeddingSearchQuery` through the global
 * QueryBus — this context never imports `embeddings`' module or repository
 * tokens directly.
 */
export interface IEmbeddingSearchPort {
  search(text: string, topK: number): Promise<IRetrievalSearchResult[]>;
}
