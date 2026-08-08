import { DateValueObject } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseEmbeddingModelValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-model/knowledge-base-embedding-model.value-object';
import { KnowledgeBaseEmbeddingStatusValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-status/knowledge-base-embedding-status.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

import { IsKnowledgeBaseEmbeddingModelUnchangedService } from './is-knowledge-base-embedding-model-unchanged.service';

function buildKnowledgeBase(
  embeddingModel = 'text-embedding-3-small',
): KnowledgeBaseAggregate {
  const now = new Date();
  return new KnowledgeBaseAggregate({
    id: KnowledgeBaseIdValueObject.generate() as KnowledgeBaseIdValueObject,
    name: new KnowledgeBaseNameValueObject('Docs'),
    description: null,
    apiKeyHash: new KnowledgeBaseApiKeyHashValueObject('a'.repeat(64)),
    embeddingModel: new KnowledgeBaseEmbeddingModelValueObject(embeddingModel),
    embeddingStatus: new KnowledgeBaseEmbeddingStatusValueObject('READY'),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('IsKnowledgeBaseEmbeddingModelUnchangedService', () => {
  const service = new IsKnowledgeBaseEmbeddingModelUnchangedService();

  it('returns true when the requested model equals the current one', () => {
    const knowledgeBase = buildKnowledgeBase('text-embedding-3-small');

    const result = service.execute(
      knowledgeBase,
      new KnowledgeBaseEmbeddingModelValueObject('text-embedding-3-small'),
    );

    expect(result).toBe(true);
  });

  it('returns false when the requested model differs from the current one', () => {
    const knowledgeBase = buildKnowledgeBase('text-embedding-3-small');

    const result = service.execute(
      knowledgeBase,
      new KnowledgeBaseEmbeddingModelValueObject('nomic-embed-text'),
    );

    expect(result).toBe(false);
  });
});
