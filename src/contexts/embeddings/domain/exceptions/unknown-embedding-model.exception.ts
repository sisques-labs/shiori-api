import { BaseException } from '@sisques-labs/nestjs-kit';

export class UnknownEmbeddingModelException extends BaseException {
  constructor(modelId: string) {
    super(`Unknown embedding model '${modelId}'`);
  }
}
