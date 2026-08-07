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
 */
export interface IEmbeddingWriteRepository extends IBaseWriteRepository<EmbeddingAggregate> {
  saveMany(embeddings: EmbeddingAggregate[]): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
  deleteByKnowledgeBaseId(knowledgeBaseId: string): Promise<void>;
}
