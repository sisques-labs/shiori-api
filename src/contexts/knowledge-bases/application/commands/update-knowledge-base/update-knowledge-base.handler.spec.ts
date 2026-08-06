import { EventBus } from '@nestjs/cqrs';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';
import { IKnowledgeBaseWriteRepository } from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import { DateValueObject } from '@sisques-labs/nestjs-kit';

import { UpdateKnowledgeBaseCommand } from './update-knowledge-base.command';
import { UpdateKnowledgeBaseCommandHandler } from './update-knowledge-base.handler';

describe('UpdateKnowledgeBaseCommandHandler', () => {
  let writeRepository: jest.Mocked<IKnowledgeBaseWriteRepository>;
  let assertExists: jest.Mocked<AssertKnowledgeBaseExistsService>;
  let eventBus: jest.Mocked<EventBus>;
  let handler: UpdateKnowledgeBaseCommandHandler;
  let kb: KnowledgeBaseAggregate;

  beforeEach(() => {
    const now = new Date();
    kb = new KnowledgeBaseAggregate({
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
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
    assertExists = { execute: jest.fn().mockResolvedValue(kb) } as any;
    eventBus = { publish: jest.fn(), publishAll: jest.fn() } as any;

    handler = new UpdateKnowledgeBaseCommandHandler(
      writeRepository,
      assertExists,
      eventBus,
    );
  });

  it('updates the name and saves', async () => {
    const command = new UpdateKnowledgeBaseCommand({
      id: kb.id.value,
      name: 'Docs v2',
    });

    await handler.execute(command);

    expect(kb.name.value).toBe('Docs v2');
    expect(writeRepository.save).toHaveBeenCalledWith(kb);
  });

  it('propagates KnowledgeBaseNotFoundException from the assert service', async () => {
    const error = new Error('not found');
    assertExists.execute.mockRejectedValue(error);

    const command = new UpdateKnowledgeBaseCommand({ id: kb.id.value });

    await expect(handler.execute(command)).rejects.toThrow(error);
    expect(writeRepository.save).not.toHaveBeenCalled();
  });
});
