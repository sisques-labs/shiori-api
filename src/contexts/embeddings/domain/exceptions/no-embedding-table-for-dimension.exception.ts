import { BaseException } from '@sisques-labs/nestjs-kit';

export class NoEmbeddingTableForDimensionException extends BaseException {
  constructor(dimensions: number) {
    super(`No embedding vector table registered for dimension ${dimensions}`);
  }
}
