import { CommandBus } from '@nestjs/cqrs';

import { AssertKnowledgeBaseViewModelExistsService } from '@contexts/knowledge-bases/application/services/read/assert-knowledge-base-view-model-exists/assert-knowledge-base-view-model-exists.service';

import { CreateKnowledgeBaseDto } from '../dtos/create-knowledge-base.dto';
import { KnowledgeBaseRestMapper } from '../mappers/knowledge-base/knowledge-base.mapper';
import { KnowledgeBasesController } from './knowledge-bases.controller';

describe('KnowledgeBasesController', () => {
  let commandBus: jest.Mocked<CommandBus>;
  let assertViewModelExists: jest.Mocked<AssertKnowledgeBaseViewModelExistsService>;
  let restMapper: KnowledgeBaseRestMapper;
  let controller: KnowledgeBasesController;

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as any;
    assertViewModelExists = { execute: jest.fn() } as any;
    restMapper = new KnowledgeBaseRestMapper();

    controller = new KnowledgeBasesController(
      commandBus,
      assertViewModelExists,
      restMapper,
    );
  });

  it('createKnowledgeBase returns the plaintext apiKey', async () => {
    commandBus.execute.mockResolvedValue({
      id: 'kb-1',
      apiKey: 'kb_plaintext',
    });
    assertViewModelExists.execute.mockResolvedValue({
      id: 'kb-1',
      name: 'Docs',
      description: null,
      apiKeyHash: 'a'.repeat(64),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const dto: CreateKnowledgeBaseDto = {
      name: 'Docs',
      embeddingModel: 'text-embedding-3-small',
    };
    const result = await controller.createKnowledgeBase(dto);

    expect(assertViewModelExists.execute).toHaveBeenCalledWith('kb-1');
    expect(result.apiKey).toBe('kb_plaintext');
    expect(result.id).toBe('kb-1');
  });

  it('getOwnKnowledgeBase resolves the caller’s own knowledge base only', async () => {
    assertViewModelExists.execute.mockResolvedValue({
      id: 'kb-1',
      name: 'Docs',
      description: null,
      apiKeyHash: 'a'.repeat(64),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await controller.getOwnKnowledgeBase('kb-1');

    expect(assertViewModelExists.execute).toHaveBeenCalledWith('kb-1');
    expect(result).not.toHaveProperty('apiKeyHash');
    expect(result).not.toHaveProperty('apiKey');
  });

  it('rotateOwnApiKey returns only the new apiKey', async () => {
    commandBus.execute.mockResolvedValue({ apiKey: 'kb_new' });

    const result = await controller.rotateOwnApiKey(
      'e3c1a1b0-0000-4000-8000-000000000001',
    );

    expect(result.apiKey).toBe('kb_new');
  });
});
