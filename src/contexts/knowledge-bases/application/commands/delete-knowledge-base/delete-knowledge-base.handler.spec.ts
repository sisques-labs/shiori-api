import { EventBus } from '@nestjs/cqrs';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';
import { IKnowledgeBaseWriteRepository } from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import { DateValueObject } from '@sisques-labs/nestjs-kit';

import { DeleteKnowledgeBaseCommand } from './delete-knowledge-base.command';
import { DeleteKnowledgeBaseCommandHandler } from './delete-knowledge-base.handler';

describe('DeleteKnowledgeBaseCommandHandler', () => {
  let writeRepository: jest.Mocked<IKnowledgeBaseWriteRepository>;
  let assertExists: jest.Mocked<AssertKnowledgeBaseExistsService>;
  let eventBus: jest.Mocked<EventBus>;
  let handler: DeleteKnowledgeBaseCommandHandler;
  let knowledgeBase: KnowledgeBaseAggregate;

  beforeEach(() => {
    const now = new Date();
    knowledgeBase = new KnowledgeBaseAggregate({
      id: KnowledgeBaseIdValueObject.generate() as KnowledgeBaseIdValueObject,
      name: new KnowledgeBaseNameValueObject('Docs'),
      description: null,
      apiKeyHash: new KnowledgeBaseApiKeyHashValueObject('a'.repeat(64)),
      createdAt: new DateValueObject(now),
      updatedAt: new DateValueObject(now),
    });

    writeRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    assertExists = {
      execute: jest.fn().mockResolvedValue(knowledgeBase),
    } as any;
    eventBus = { publish: jest.fn(), publishAll: jest.fn() } as any;

    handler = new DeleteKnowledgeBaseCommandHandler(
      writeRepository,
      assertExists,
      eventBus,
    );
  });

  it('deletes the knowledge base', async () => {
    const command = new DeleteKnowledgeBaseCommand({
      id: knowledgeBase.id.value,
    });

    await handler.execute(command);

    expect(writeRepository.delete).toHaveBeenCalledWith(knowledgeBase.id.value);
  });

  it('propagates KnowledgeBaseNotFoundException from the assert service', async () => {
    const error = new Error('not found');
    assertExists.execute.mockRejectedValue(error);

    const command = new DeleteKnowledgeBaseCommand({
      id: knowledgeBase.id.value,
    });

    await expect(handler.execute(command)).rejects.toThrow(error);
    expect(writeRepository.delete).not.toHaveBeenCalled();
  });
});
