import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';

import { EmbeddingViewModel } from '@contexts/embeddings/domain/view-models/embedding.view-model';

export const EMBEDDING_READ_REPOSITORY = Symbol('EMBEDDING_READ_REPOSITORY');

export interface IEmbeddingSearchResult {
  chunkId: string;
  documentId: string;
  chunkText: string;
  chunkPosition: number;
  score: number;
}

/**
 * findById/findByCriteria/save/delete (from IBaseReadRepository) have no
 * current caller — the only read this context ever performs from another
 * consumer is `search()`, a similarity search, never a single-entity or
 * Criteria-paginated lookup — but implementing the base interface keeps
 * this repository consistent with the rest of the codebase.
 */
export interface IEmbeddingReadRepository extends IBaseReadRepository<EmbeddingViewModel> {
  search(vector: number[], topK: number): Promise<IEmbeddingSearchResult[]>;
}
