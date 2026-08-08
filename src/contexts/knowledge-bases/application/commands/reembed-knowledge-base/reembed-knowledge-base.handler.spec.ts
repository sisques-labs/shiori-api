import { EventBus } from '@nestjs/cqrs';
import { DateValueObject } from '@sisques-labs/nestjs-kit';

import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import { AssertKnowledgeBaseNotReembeddingService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-not-reembedding/assert-knowledge-base-not-reembedding.service';
import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseReembeddingInProgressException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-reembedding-in-progress.exception';
import { IKnowledgeBaseWriteRepository } from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseEmbeddingModelValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-model/knowledge-base-embedding-model.value-object';
import { KnowledgeBaseEmbeddingStatusValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-status/knowledge-base-embedding-status.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

import { ReembedKnowledgeBaseCommand } from './reembed-knowledge-base.command';
import { ReembedKnowledgeBaseCommandHandler } from './reembed-knowledge-base.handler';

function buildKnowledgeBase(
  embeddingModel = 'text-embedding-3-small',
  embeddingStatus = 'READY',
): KnowledgeBaseAggregate {
  const now = new Date();
  return new KnowledgeBaseAggregate({
    id: KnowledgeBaseIdValueObject.generate() as KnowledgeBaseIdValueObject,
    name: new KnowledgeBaseNameValueObject('Docs'),
    description: null,
    apiKeyHash: new KnowledgeBaseApiKeyHashValueObject('a'.repeat(64)),
    embeddingModel: new KnowledgeBaseEmbeddingModelValueObject(embeddingModel),
    embeddingStatus: new KnowledgeBaseEmbeddingStatusValueObject(
      embeddingStatus,
    ),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('ReembedKnowledgeBaseCommandHandler', () => {
  let writeRepository: jest.Mocked<IKnowledgeBaseWriteRepository>;
  let assertExists: jest.Mocked<AssertKnowledgeBaseExistsService>;
  let assertNotReembedding: AssertKnowledgeBaseNotReembeddingService;
  let eventBus: jest.Mocked<EventBus>;
  let handler: ReembedKnowledgeBaseCommandHandler;
  let knowledgeBase: KnowledgeBaseAggregate;

  beforeEach(() => {
    knowledgeBase = buildKnowledgeBase();
    writeRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
    assertExists = {
      execute: jest.fn().mockResolvedValue(knowledgeBase),
    } as any;
    assertNotReembedding = new AssertKnowledgeBaseNotReembeddingService();
    eventBus = { publish: jest.fn(), publishAll: jest.fn() } as any;

    handler = new ReembedKnowledgeBaseCommandHandler(
      writeRepository,
      assertExists,
      assertNotReembedding,
      eventBus,
    );
  });

  it('happy path: flips to REEMBEDDING under the current model, saves, and publishes the event', async () => {
    const command = new ReembedKnowledgeBaseCommand({
      id: knowledgeBase.id.value,
    });

    await handler.execute(command);

    expect(knowledgeBase.embeddingModel.value).toBe('text-embedding-3-small');
    expect(knowledgeBase.embeddingStatus.value).toBe('REEMBEDDING');
    expect(writeRepository.save).toHaveBeenCalledWith(knowledgeBase);
    expect(eventBus.publishAll).toHaveBeenCalled();
  });

  it('is retryable from FAILED', async () => {
    knowledgeBase = buildKnowledgeBase('text-embedding-3-small', 'FAILED');
    assertExists.execute.mockResolvedValue(knowledgeBase);
    const command = new ReembedKnowledgeBaseCommand({
      id: knowledgeBase.id.value,
    });

    await handler.execute(command);

    expect(knowledgeBase.embeddingStatus.value).toBe('REEMBEDDING');
    expect(writeRepository.save).toHaveBeenCalledWith(knowledgeBase);
  });

  it('rejects with 409 when already REEMBEDDING', async () => {
    knowledgeBase = buildKnowledgeBase('text-embedding-3-small', 'REEMBEDDING');
    assertExists.execute.mockResolvedValue(knowledgeBase);
    const command = new ReembedKnowledgeBaseCommand({
      id: knowledgeBase.id.value,
    });

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      KnowledgeBaseReembeddingInProgressException,
    );
    expect(writeRepository.save).not.toHaveBeenCalled();
  });
});
