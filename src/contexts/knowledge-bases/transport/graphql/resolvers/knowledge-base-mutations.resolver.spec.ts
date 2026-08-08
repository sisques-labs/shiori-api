import { CommandBus } from '@nestjs/cqrs';
import { MutationResponseGraphQLMapper } from '@sisques-labs/nestjs-kit/graphql';

import { AssertKnowledgeBaseViewModelExistsService } from '@contexts/knowledge-bases/application/services/read/assert-knowledge-base-view-model-exists/assert-knowledge-base-view-model-exists.service';

import { CreateKnowledgeBaseGraphQLDto } from '../dtos/requests/create-knowledge-base-graphql.dto';
import { KnowledgeBaseGraphQLMapper } from '../mappers/knowledge-base/knowledge-base.mapper';
import { KnowledgeBaseMutationsResolver } from './knowledge-base-mutations.resolver';

describe('KnowledgeBaseMutationsResolver', () => {
  let commandBus: jest.Mocked<CommandBus>;
  let mutationResponseGraphQLMapper: jest.Mocked<MutationResponseGraphQLMapper>;
  let graphQLMapper: KnowledgeBaseGraphQLMapper;
  let assertViewModelExists: jest.Mocked<AssertKnowledgeBaseViewModelExistsService>;
  let resolver: KnowledgeBaseMutationsResolver;

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as any;
    mutationResponseGraphQLMapper = {
      toResponseDto: jest.fn((props) => props),
    } as any;
    graphQLMapper = new KnowledgeBaseGraphQLMapper();
    assertViewModelExists = { execute: jest.fn() } as any;
    resolver = new KnowledgeBaseMutationsResolver(
      commandBus,
      mutationResponseGraphQLMapper,
      graphQLMapper,
      assertViewModelExists,
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

    const input: CreateKnowledgeBaseGraphQLDto = {
      name: 'Docs',
      embeddingModel: 'text-embedding-3-small',
    };
    const result = await resolver.createKnowledgeBase(input);

    expect(assertViewModelExists.execute).toHaveBeenCalledWith('kb-1');
    expect(result.apiKey).toBe('kb_plaintext');
  });

  it('updateKnowledgeBase dispatches with the caller’s own id', async () => {
    const id = 'e3c1a1b0-0000-4000-8000-000000000001';

    await resolver.updateKnowledgeBase({ name: 'Docs v2' }, id);

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.objectContaining({ value: id }),
      }),
    );
    expect(mutationResponseGraphQLMapper.toResponseDto).toHaveBeenCalledWith(
      expect.objectContaining({ id }),
    );
  });

  it('rotateKnowledgeBaseApiKey returns only the new key', async () => {
    commandBus.execute.mockResolvedValue({ apiKey: 'kb_new' });

    const result = await resolver.rotateKnowledgeBaseApiKey(
      'e3c1a1b0-0000-4000-8000-000000000001',
    );

    expect(result.apiKey).toBe('kb_new');
  });
});
