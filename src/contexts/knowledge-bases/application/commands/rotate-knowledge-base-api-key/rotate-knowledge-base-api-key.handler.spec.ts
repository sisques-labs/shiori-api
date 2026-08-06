import { EventBus } from '@nestjs/cqrs';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';
import { IKnowledgeBaseWriteRepository } from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import { GenerateApiKeyService } from '@contexts/knowledge-bases/application/services/write/generate-api-key/generate-api-key.service';
import { HashApiKeyService } from '@contexts/knowledge-bases/application/services/write/hash-api-key/hash-api-key.service';
import { DateValueObject } from '@sisques-labs/nestjs-kit';

import { RotateKnowledgeBaseApiKeyCommand } from './rotate-knowledge-base-api-key.command';
import { RotateKnowledgeBaseApiKeyCommandHandler } from './rotate-knowledge-base-api-key.handler';

describe('RotateKnowledgeBaseApiKeyCommandHandler', () => {
  let writeRepository: jest.Mocked<IKnowledgeBaseWriteRepository>;
  let assertExists: jest.Mocked<AssertKnowledgeBaseExistsService>;
  let eventBus: jest.Mocked<EventBus>;
  let handler: RotateKnowledgeBaseApiKeyCommandHandler;
  let kb: KnowledgeBaseAggregate;
  const oldHash = 'a'.repeat(64);

  beforeEach(() => {
    const now = new Date();
    kb = new KnowledgeBaseAggregate({
      id: KnowledgeBaseIdValueObject.generate() as KnowledgeBaseIdValueObject,
      name: new KnowledgeBaseNameValueObject('Docs'),
      description: null,
      apiKeyHash: new KnowledgeBaseApiKeyHashValueObject(oldHash),
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

    handler = new RotateKnowledgeBaseApiKeyCommandHandler(
      writeRepository,
      assertExists,
      new GenerateApiKeyService(),
      new HashApiKeyService(),
      eventBus,
    );
  });

  it('replaces the hash and the old key no longer matches', async () => {
    const command = new RotateKnowledgeBaseApiKeyCommand({ id: kb.id.value });

    await handler.execute(command);

    expect(kb.apiKeyHash.value).not.toBe(oldHash);
  });

  it('returns the new plaintext key', async () => {
    const command = new RotateKnowledgeBaseApiKeyCommand({ id: kb.id.value });
    const hashService = new HashApiKeyService();

    const result = await handler.execute(command);

    expect(result.apiKey).toMatch(/^kb_/);
    expect(kb.apiKeyHash.value).toBe(hashService.execute(result.apiKey));
  });
});
