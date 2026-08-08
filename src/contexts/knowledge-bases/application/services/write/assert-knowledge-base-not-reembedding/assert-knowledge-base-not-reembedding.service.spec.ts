import { DateValueObject } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseReembeddingInProgressException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-reembedding-in-progress.exception';
import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseEmbeddingModelValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-model/knowledge-base-embedding-model.value-object';
import { KnowledgeBaseEmbeddingStatusValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-status/knowledge-base-embedding-status.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

import { AssertKnowledgeBaseNotReembeddingService } from './assert-knowledge-base-not-reembedding.service';

function buildKnowledgeBase(embeddingStatus: string): KnowledgeBaseAggregate {
  const now = new Date();
  return new KnowledgeBaseAggregate({
    id: KnowledgeBaseIdValueObject.generate() as KnowledgeBaseIdValueObject,
    name: new KnowledgeBaseNameValueObject('Docs'),
    description: null,
    apiKeyHash: new KnowledgeBaseApiKeyHashValueObject('a'.repeat(64)),
    embeddingModel: new KnowledgeBaseEmbeddingModelValueObject(
      'text-embedding-3-small',
    ),
    embeddingStatus: new KnowledgeBaseEmbeddingStatusValueObject(
      embeddingStatus,
    ),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('AssertKnowledgeBaseNotReembeddingService', () => {
  const service = new AssertKnowledgeBaseNotReembeddingService();

  it('does nothing when READY', () => {
    expect(() => service.execute(buildKnowledgeBase('READY'))).not.toThrow();
  });

  it('does nothing when FAILED', () => {
    expect(() => service.execute(buildKnowledgeBase('FAILED'))).not.toThrow();
  });

  it('throws KnowledgeBaseReembeddingInProgressException when REEMBEDDING', () => {
    expect(() => service.execute(buildKnowledgeBase('REEMBEDDING'))).toThrow(
      KnowledgeBaseReembeddingInProgressException,
    );
  });
});
