import { EventBus } from '@nestjs/cqrs';

import { KnowledgeBaseBuilder } from '@contexts/knowledge-bases/domain/builders/knowledge-base.builder';
import { IKnowledgeBaseWriteRepository } from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { GenerateApiKeyService } from '@contexts/knowledge-bases/application/services/write/generate-api-key/generate-api-key.service';
import { HashApiKeyService } from '@core/tenancy/hash-api-key.service';

import { CreateKnowledgeBaseCommand } from './create-knowledge-base.command';
import { CreateKnowledgeBaseCommandHandler } from './create-knowledge-base.handler';

describe('CreateKnowledgeBaseCommandHandler', () => {
  let writeRepository: jest.Mocked<IKnowledgeBaseWriteRepository>;
  let eventBus: jest.Mocked<EventBus>;
  let handler: CreateKnowledgeBaseCommandHandler;

  beforeEach(() => {
    writeRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn(), publishAll: jest.fn() } as any;

    handler = new CreateKnowledgeBaseCommandHandler(
      writeRepository,
      new KnowledgeBaseBuilder(),
      new GenerateApiKeyService(),
      new HashApiKeyService(),
      eventBus,
    );
  });

  it('saves the aggregate with a hash, never the raw key', async () => {
    const command = new CreateKnowledgeBaseCommand({ name: 'Docs' });

    await handler.execute(command);

    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    const savedAggregate = writeRepository.save.mock.calls[0][0];
    expect(savedAggregate.apiKeyHash.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the plaintext apiKey in the result', async () => {
    const command = new CreateKnowledgeBaseCommand({ name: 'Docs' });

    const result = await handler.execute(command);

    expect(result.apiKey).toMatch(/^kb_/);
    expect(result).not.toHaveProperty('apiKeyHash');
  });

  it('hashes the returned apiKey to the persisted hash', async () => {
    const command = new CreateKnowledgeBaseCommand({ name: 'Docs' });
    const hashService = new HashApiKeyService();

    const result = await handler.execute(command);

    const savedAggregate = writeRepository.save.mock.calls[0][0];
    expect(savedAggregate.apiKeyHash.value).toBe(
      hashService.execute(result.apiKey),
    );
  });
});
