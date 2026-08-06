import { BaseException } from '@sisques-labs/nestjs-kit';

export class DocumentTooManyChunksException extends BaseException {
  constructor(chunkCount: number, maxChunks: number) {
    super(
      `Chunking produced ${chunkCount} chunks, exceeding the maximum of ${maxChunks}`,
    );
  }
}
