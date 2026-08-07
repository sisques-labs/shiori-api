import { EmbeddingAggregate } from '@contexts/embeddings/domain/aggregates/embedding.aggregate';

export const EMBEDDING_WRITE_REPOSITORY = Symbol('EMBEDDING_WRITE_REPOSITORY');

/**
 * Not IBaseWriteRepository<T> — embeddings have no single-entity CRUD
 * surface from transport, only batch/by-document/by-knowledge-base
 * operations driven by the embedding processor and cascade deletes.
 */
export interface IEmbeddingWriteRepository {
  saveMany(embeddings: EmbeddingAggregate[]): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
  deleteByKnowledgeBaseId(knowledgeBaseId: string): Promise<void>;
}
