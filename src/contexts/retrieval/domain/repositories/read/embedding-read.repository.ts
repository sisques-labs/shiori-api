export const EMBEDDING_READ_REPOSITORY = Symbol('EMBEDDING_READ_REPOSITORY');

export interface IRetrievalSearchResult {
  chunkId: string;
  documentId: string;
  chunkText: string;
  chunkPosition: number;
  score: number;
}

/**
 * Not IBaseReadRepository<T> — the only read this context ever performs is
 * a similarity search, never a single-entity or Criteria-paginated lookup.
 */
export interface IEmbeddingReadRepository {
  search(vector: number[], topK: number): Promise<IRetrievalSearchResult[]>;
}
