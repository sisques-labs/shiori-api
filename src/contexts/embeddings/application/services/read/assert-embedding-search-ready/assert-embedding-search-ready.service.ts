import { Injectable } from '@nestjs/common';

import { EmbeddingSearchNotReadyException } from '@contexts/embeddings/domain/exceptions/embedding-search-not-ready.exception';

@Injectable()
export class AssertEmbeddingSearchReadyService {
  execute(knowledgeBaseId: string, embeddingStatus: string): void {
    if (embeddingStatus !== 'READY') {
      throw new EmbeddingSearchNotReadyException(
        knowledgeBaseId,
        embeddingStatus,
      );
    }
  }
}
