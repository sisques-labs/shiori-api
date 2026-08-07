import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';

import { ChunkAggregate } from '@contexts/documents/domain/aggregates/chunk.aggregate';

export const CHUNK_WRITE_REPOSITORY = Symbol('CHUNK_WRITE_REPOSITORY');

/**
 * findById/findByCriteria/save/delete (from IBaseWriteRepository) have no
 * current caller — chunks are driven by batch/by-document operations
 * (saveMany, deleteByDocumentId, findByDocumentId) from the chunking
 * processor and cascade deletes — but implementing the base interface keeps
 * this repository consistent with the rest of the codebase.
 */
export interface IChunkWriteRepository extends IBaseWriteRepository<ChunkAggregate> {
  saveMany(chunks: ChunkAggregate[]): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
  findByDocumentId(documentId: string): Promise<ChunkAggregate[]>;
}
