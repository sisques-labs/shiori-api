import { BaseException } from '@sisques-labs/nestjs-kit';

export class InvalidKnowledgeBaseEmbeddingModelException extends BaseException {
  constructor(modelId: string) {
    super(`'${modelId}' is not a known embedding model`);
  }
}
