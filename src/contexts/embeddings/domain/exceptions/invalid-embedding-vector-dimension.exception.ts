import { BaseException } from '@sisques-labs/nestjs-kit';

export class InvalidEmbeddingVectorDimensionException extends BaseException {
  constructor(actual: number, expected: number) {
    super(`Embedding vector has ${actual} dimensions, expected ${expected}`);
  }
}
