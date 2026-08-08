import { EventBus } from '@nestjs/cqrs';

import { IEmbeddingModelValidationPort } from '@contexts/knowledge-bases/application/ports/embedding-model-validation.port';
import { KnowledgeBaseBuilder } from '@contexts/knowledge-bases/domain/builders/knowledge-base.builder';
import { InvalidEmbeddingModelException } from '@contexts/knowledge-bases/domain/exceptions/invalid-embedding-model.exception';
import { IKnowledgeBaseWriteRepository } from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { GenerateApiKeyService } from '@contexts/knowledge-bases/application/services/write/generate-api-key/generate-api-key.service';
import { IHashApiKeyPort } from '@contexts/knowledge-bases/application/ports/hash-api-key.port';
import { HashApiKeyService } from '@core/tenancy/hash-api-key.service';

import { CreateKnowledgeBaseCommand } from './create-knowledge-base.command';
import { CreateKnowledgeBaseCommandHandler } from './create-knowledge-base.handler';

describe('CreateKnowledgeBaseCommandHandler', () => {
  let writeRepository: jest.Mocked<IKnowledgeBaseWriteRepository>;
  let eventBus: jest.Mocked<EventBus>;
  let hashApiKey: IHashApiKeyPort;
  let embeddingModelValidation: jest.Mocked<IEmbeddingModelValidationPort>;
  let handler: CreateKnowledgeBaseCommandHandler;

  beforeEach(() => {
    writeRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn(), publishAll: jest.fn() } as any;
    hashApiKey = {
      hash: (rawKey: string) =>
        Promise.resolve(new HashApiKeyService().execute(rawKey)),
    };
    embeddingModelValidation = { isValid: jest.fn().mockResolvedValue(true) };

    handler = new CreateKnowledgeBaseCommandHandler(
      writeRepository,
      new KnowledgeBaseBuilder(),
      new GenerateApiKeyService(),
      hashApiKey,
      embeddingModelValidation,
      eventBus,
    );
  });

  it('saves the aggregate with a hash, never the raw key', async () => {
    const command = new CreateKnowledgeBaseCommand({
      name: 'Docs',
      embeddingModel: 'text-embedding-3-small',
    });

    await handler.execute(command);

    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    const savedAggregate = writeRepository.save.mock.calls[0][0];
    expect(savedAggregate.apiKeyHash.value).toMatch(/^[0-9a-f]{64}$/);
    expect(savedAggregate.embeddingModel.value).toBe('text-embedding-3-small');
    expect(savedAggregate.embeddingStatus.value).toBe('READY');
  });

  it('returns the plaintext apiKey in the result', async () => {
    const command = new CreateKnowledgeBaseCommand({
      name: 'Docs',
      embeddingModel: 'text-embedding-3-small',
    });

    const result = await handler.execute(command);

    expect(result.apiKey).toMatch(/^kb_/);
    expect(result).not.toHaveProperty('apiKeyHash');
  });

  it('hashes the returned apiKey to the persisted hash', async () => {
    const command = new CreateKnowledgeBaseCommand({
      name: 'Docs',
      embeddingModel: 'text-embedding-3-small',
    });
    const hashService = new HashApiKeyService();

    const result = await handler.execute(command);

    const savedAggregate = writeRepository.save.mock.calls[0][0];
    expect(savedAggregate.apiKeyHash.value).toBe(
      hashService.execute(result.apiKey),
    );
  });

  it('rejects an unknown embedding model before touching the aggregate', async () => {
    embeddingModelValidation.isValid.mockResolvedValue(false);
    const command = new CreateKnowledgeBaseCommand({
      name: 'Docs',
      embeddingModel: 'not-a-real-model',
    });

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      InvalidEmbeddingModelException,
    );
    expect(writeRepository.save).not.toHaveBeenCalled();
  });
});
