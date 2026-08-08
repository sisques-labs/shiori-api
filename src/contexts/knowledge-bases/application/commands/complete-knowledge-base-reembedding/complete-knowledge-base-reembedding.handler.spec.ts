import { EventBus } from '@nestjs/cqrs';
import { DateValueObject } from '@sisques-labs/nestjs-kit';

import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { IKnowledgeBaseWriteRepository } from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseEmbeddingModelValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-model/knowledge-base-embedding-model.value-object';
import { KnowledgeBaseEmbeddingStatusValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-status/knowledge-base-embedding-status.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

import { CompleteKnowledgeBaseReembeddingCommand } from './complete-knowledge-base-reembedding.command';
import { CompleteKnowledgeBaseReembeddingCommandHandler } from './complete-knowledge-base-reembedding.handler';

describe('CompleteKnowledgeBaseReembeddingCommandHandler', () => {
  it('sets embeddingStatus to READY and saves', async () => {
    const now = new Date();
    const knowledgeBase = new KnowledgeBaseAggregate({
      id: KnowledgeBaseIdValueObject.generate() as KnowledgeBaseIdValueObject,
      name: new KnowledgeBaseNameValueObject('Docs'),
      description: null,
      apiKeyHash: new KnowledgeBaseApiKeyHashValueObject('a'.repeat(64)),
      embeddingModel: new KnowledgeBaseEmbeddingModelValueObject(
        'nomic-embed-text',
      ),
      embeddingStatus: new KnowledgeBaseEmbeddingStatusValueObject(
        'REEMBEDDING',
      ),
      createdAt: new DateValueObject(now),
      updatedAt: new DateValueObject(now),
    });

    const writeRepository: jest.Mocked<IKnowledgeBaseWriteRepository> = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
    const assertExists = {
      execute: jest.fn().mockResolvedValue(knowledgeBase),
    } as unknown as jest.Mocked<AssertKnowledgeBaseExistsService>;
    const eventBus = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventBus>;

    const handler = new CompleteKnowledgeBaseReembeddingCommandHandler(
      writeRepository,
      assertExists,
      eventBus,
    );

    await handler.execute(
      new CompleteKnowledgeBaseReembeddingCommand({
        id: knowledgeBase.id.value,
      }),
    );

    expect(knowledgeBase.embeddingStatus.value).toBe('READY');
    expect(writeRepository.save).toHaveBeenCalledWith(knowledgeBase);
  });
});
