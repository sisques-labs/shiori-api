import { BaseException } from '@sisques-labs/nestjs-kit';

export class EmbeddingSearchNotReadyException extends BaseException {
  constructor(knowledgeBaseId: string, embeddingStatus: string) {
    super(
      `Knowledge base '${knowledgeBaseId}' is not ready for search (status: ${embeddingStatus})`,
    );
  }
}
