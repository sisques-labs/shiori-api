import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  CHUNK_WRITE_REPOSITORY,
  IChunkWriteRepository,
} from '@contexts/documents/domain/repositories/write/chunk-write.repository';

import { ChunkFindByDocumentIdQuery } from './chunk-find-by-document-id.query';

export interface ChunkFindByDocumentIdResult {
  id: string;
  text: string;
  position: number;
}

/**
 * Internal only — no transport surface. Dispatched exclusively by other
 * contexts (currently `retrieval`'s `DocumentChunkSourceAdapter`) via the
 * global QueryBus, the established cross-context read seam in this
 * codebase (see `care-schedule`'s `CareLogAdapter` in the sibling
 * gardenia-api service for the same pattern) — no context ever imports
 * another context's module or repository token directly.
 */
@QueryHandler(ChunkFindByDocumentIdQuery)
export class ChunkFindByDocumentIdQueryHandler implements IQueryHandler<
  ChunkFindByDocumentIdQuery,
  ChunkFindByDocumentIdResult[]
> {
  private readonly logger = new Logger(ChunkFindByDocumentIdQueryHandler.name);

  constructor(
    @Inject(CHUNK_WRITE_REPOSITORY)
    private readonly chunkWriteRepository: IChunkWriteRepository,
  ) {}

  async execute(
    query: ChunkFindByDocumentIdQuery,
  ): Promise<ChunkFindByDocumentIdResult[]> {
    this.logger.log(`Finding chunks for document: ${query.documentId}`);

    const chunks = await this.chunkWriteRepository.findByDocumentId(
      query.documentId,
    );

    return chunks.map((chunk) => ({
      id: chunk.id.value,
      text: chunk.text.value,
      position: chunk.position.value,
    }));
  }
}
