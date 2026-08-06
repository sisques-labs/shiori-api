import { Inject, Injectable } from '@nestjs/common';

import {
  IChunkSourceItem,
  IChunkSourcePort,
} from '@contexts/retrieval/application/ports/chunk-source.port';
import {
  CHUNK_WRITE_REPOSITORY,
  IChunkWriteRepository,
} from '@contexts/documents/domain/repositories/write/chunk-write.repository';

/**
 * Implements `ChunkSourcePort` by consuming `documents`' own exported
 * `CHUNK_WRITE_REPOSITORY` — this context never queries `documents`' tables
 * directly. Lives in `infrastructure/adapters/`, the ESLint-permitted seam
 * for importing another context's provider token.
 */
@Injectable()
export class DocumentChunkSourceAdapter implements IChunkSourcePort {
  constructor(
    @Inject(CHUNK_WRITE_REPOSITORY)
    private readonly chunkWriteRepository: IChunkWriteRepository,
  ) {}

  async findByDocumentId(documentId: string): Promise<IChunkSourceItem[]> {
    const chunks = await this.chunkWriteRepository.findByDocumentId(documentId);

    return chunks.map((chunk) => ({
      id: chunk.id.value,
      text: chunk.text.value,
      position: chunk.position.value,
    }));
  }
}
