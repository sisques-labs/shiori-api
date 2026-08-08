import { Injectable } from '@nestjs/common';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseEmbeddingModelValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-model/knowledge-base-embedding-model.value-object';

/**
 * Not an `IBaseService` — it answers a question rather than asserting an
 * invariant, so it returns a boolean instead of throwing.
 */
@Injectable()
export class IsKnowledgeBaseEmbeddingModelUnchangedService {
  execute(
    knowledgeBase: KnowledgeBaseAggregate,
    requestedModel: KnowledgeBaseEmbeddingModelValueObject,
  ): boolean {
    return knowledgeBase.embeddingModel.equals(requestedModel);
  }
}
