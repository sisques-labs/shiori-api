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
  /**
   * `dimensions` determines which `embedding_vectors_{dimension}` table to
   * JOIN against before the `ORDER BY ... <=> ...` even runs. An
   * unregistered dimension throws `NoEmbeddingTableForDimensionException`.
   *
   * `model` is required, not just `dimensions`: several models can share a
   * dimension count (that's the whole point of not needing a migration to
   * add one), so more than one model's rows can live in the same
   * `embedding_vectors_{dimension}` table for the same Knowledge Base —
   * e.g. right after a `ChangeKnowledgeBaseEmbeddingModel` re-embed. Cosine
   * distance between vectors from two different models is meaningless, so
   * this must scope to the querying model as well as the dimension table.
   */
  search(
    vector: number[],
    topK: number,
    dimensions: number,
    model: string,
  ): Promise<IEmbeddingSearchResult[]>;
}
