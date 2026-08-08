import { EventBus } from '@nestjs/cqrs';
import { DateValueObject } from '@sisques-labs/nestjs-kit';

import { IEmbeddingModelValidationPort } from '@contexts/knowledge-bases/application/ports/embedding-model-validation.port';
import { AssertEmbeddingModelIsValidService } from '@contexts/knowledge-bases/application/services/write/assert-embedding-model-is-valid/assert-embedding-model-is-valid.service';
import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import { AssertKnowledgeBaseNotReembeddingService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-not-reembedding/assert-knowledge-base-not-reembedding.service';
import { IsKnowledgeBaseEmbeddingModelUnchangedService } from '@contexts/knowledge-bases/application/services/write/is-knowledge-base-embedding-model-unchanged/is-knowledge-base-embedding-model-unchanged.service';
import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { InvalidKnowledgeBaseEmbeddingModelException } from '@contexts/knowledge-bases/domain/exceptions/invalid-knowledge-base-embedding-model.exception';
import { KnowledgeBaseReembeddingInProgressException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-reembedding-in-progress.exception';
import { IKnowledgeBaseWriteRepository } from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseEmbeddingModelValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-model/knowledge-base-embedding-model.value-object';
import { KnowledgeBaseEmbeddingStatusValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-status/knowledge-base-embedding-status.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

import { ChangeKnowledgeBaseEmbeddingModelCommand } from './change-knowledge-base-embedding-model.command';
import { ChangeKnowledgeBaseEmbeddingModelCommandHandler } from './change-knowledge-base-embedding-model.handler';

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

describe('ChangeKnowledgeBaseEmbeddingModelCommandHandler', () => {
  let writeRepository: jest.Mocked<IKnowledgeBaseWriteRepository>;
  let assertExists: jest.Mocked<AssertKnowledgeBaseExistsService>;
  let embeddingModelValidation: jest.Mocked<IEmbeddingModelValidationPort>;
  let assertEmbeddingModelIsValid: AssertEmbeddingModelIsValidService;
  let isEmbeddingModelUnchanged: IsKnowledgeBaseEmbeddingModelUnchangedService;
  let assertNotReembedding: AssertKnowledgeBaseNotReembeddingService;
  let eventBus: jest.Mocked<EventBus>;
  let handler: ChangeKnowledgeBaseEmbeddingModelCommandHandler;
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
    embeddingModelValidation = { isValid: jest.fn().mockResolvedValue(true) };
    assertEmbeddingModelIsValid = new AssertEmbeddingModelIsValidService(
      embeddingModelValidation,
    );
    isEmbeddingModelUnchanged =
      new IsKnowledgeBaseEmbeddingModelUnchangedService();
    assertNotReembedding = new AssertKnowledgeBaseNotReembeddingService();
    eventBus = { publish: jest.fn(), publishAll: jest.fn() } as any;

    handler = new ChangeKnowledgeBaseEmbeddingModelCommandHandler(
      writeRepository,
      assertExists,
      assertEmbeddingModelIsValid,
      isEmbeddingModelUnchanged,
      assertNotReembedding,
      eventBus,
    );
  });

  it('happy path: flips to REEMBEDDING, saves, and publishes the event', async () => {
    const command = new ChangeKnowledgeBaseEmbeddingModelCommand({
      id: knowledgeBase.id.value,
      embeddingModel: 'nomic-embed-text',
    });

    await handler.execute(command);

    expect(knowledgeBase.embeddingModel.value).toBe('nomic-embed-text');
    expect(knowledgeBase.embeddingStatus.value).toBe('REEMBEDDING');
    expect(writeRepository.save).toHaveBeenCalledWith(knowledgeBase);
    expect(eventBus.publishAll).toHaveBeenCalled();
  });

  it('is a no-op when the new model equals the current one', async () => {
    const command = new ChangeKnowledgeBaseEmbeddingModelCommand({
      id: knowledgeBase.id.value,
      embeddingModel: 'text-embedding-3-small',
    });

    await handler.execute(command);

    expect(knowledgeBase.embeddingStatus.value).toBe('READY');
    expect(writeRepository.save).not.toHaveBeenCalled();
    expect(eventBus.publishAll).not.toHaveBeenCalled();
  });

  it('rejects an unknown embedding model with InvalidKnowledgeBaseEmbeddingModelException', async () => {
    embeddingModelValidation.isValid.mockResolvedValue(false);
    const command = new ChangeKnowledgeBaseEmbeddingModelCommand({
      id: knowledgeBase.id.value,
      embeddingModel: 'not-a-real-model',
    });

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      InvalidKnowledgeBaseEmbeddingModelException,
    );
    expect(writeRepository.save).not.toHaveBeenCalled();
  });

  it('rejects with 409 when already REEMBEDDING and a different model is requested', async () => {
    knowledgeBase = buildKnowledgeBase('text-embedding-3-small', 'REEMBEDDING');
    assertExists.execute.mockResolvedValue(knowledgeBase);
    const command = new ChangeKnowledgeBaseEmbeddingModelCommand({
      id: knowledgeBase.id.value,
      embeddingModel: 'nomic-embed-text',
    });

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      KnowledgeBaseReembeddingInProgressException,
    );
    expect(writeRepository.save).not.toHaveBeenCalled();
  });

  it('no-ops even while REEMBEDDING when the same model is requested again', async () => {
    knowledgeBase = buildKnowledgeBase('text-embedding-3-small', 'REEMBEDDING');
    assertExists.execute.mockResolvedValue(knowledgeBase);
    const command = new ChangeKnowledgeBaseEmbeddingModelCommand({
      id: knowledgeBase.id.value,
      embeddingModel: 'text-embedding-3-small',
    });

    await handler.execute(command);

    expect(writeRepository.save).not.toHaveBeenCalled();
  });
});
