import { Injectable } from '@nestjs/common';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseEmbeddingStatusEnum } from '@contexts/knowledge-bases/domain/enums/knowledge-base-embedding-status.enum';
import { KnowledgeBaseReembeddingInProgressException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-reembedding-in-progress.exception';

@Injectable()
export class AssertKnowledgeBaseNotReembeddingService {
  execute(knowledgeBase: KnowledgeBaseAggregate): void {
    if (
      knowledgeBase.embeddingStatus.value ===
      KnowledgeBaseEmbeddingStatusEnum.REEMBEDDING
    ) {
      throw new KnowledgeBaseReembeddingInProgressException(
        knowledgeBase.id.value,
      );
    }
  }
}
