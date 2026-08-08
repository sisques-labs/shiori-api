import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';

import { EmbeddingAggregate } from '@contexts/embeddings/domain/aggregates/embedding.aggregate';

export const EMBEDDING_WRITE_REPOSITORY = Symbol('EMBEDDING_WRITE_REPOSITORY');

/**
 * findById/findByCriteria/save/delete (from IBaseWriteRepository) have no
 * current caller — embeddings are driven by batch/by-document/
 * by-knowledge-base operations (saveMany, deleteByDocumentId,
 * deleteByKnowledgeBaseId) from the embedding processor and cascade
 * deletes — but implementing the base interface keeps this repository
 * consistent with the rest of the codebase.
 *
 * `deleteByDocumentId`/`deleteByKnowledgeBaseId` deliberately do NOT take a
 * `dimensions` parameter — they delete from the `embeddings` metadata table
 * only, relying on `ON DELETE CASCADE` to remove the corresponding row from
 * whichever `embedding_vectors_{dimension}` table actually holds it. Only
 * `saveMany` (insert) needs an explicit dimension, to know which vector
 * table to write into.
 */
export interface IEmbeddingWriteRepository extends IBaseWriteRepository<EmbeddingAggregate> {
  saveMany(embeddings: EmbeddingAggregate[], dimensions: number): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
  deleteByKnowledgeBaseId(knowledgeBaseId: string): Promise<void>;
  /**
   * Used only by the re-embed pipeline: clears one specific model's rows
   * for a Knowledge Base without touching another model's rows for the
   * same tenant, even when both models share a dimension (and therefore a
   * vector table). Filters by the `model` column, never by dimension.
   */
  deleteByKnowledgeBaseIdAndModel(
    knowledgeBaseId: string,
    model: string,
  ): Promise<void>;
}
