import { ChunkAggregate } from '@contexts/documents/domain/aggregates/chunk.aggregate';

export const CHUNK_WRITE_REPOSITORY = Symbol('CHUNK_WRITE_REPOSITORY');

/**
 * Not IBaseWriteRepository<T> — chunks have no single-entity CRUD surface
 * from transport, only batch/by-document operations driven by the chunking
 * processor and cascade deletes.
 */
export interface IChunkWriteRepository {
  saveMany(chunks: ChunkAggregate[]): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
  findByDocumentId(documentId: string): Promise<ChunkAggregate[]>;
}
