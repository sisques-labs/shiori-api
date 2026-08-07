import { AssertKnowledgeBaseViewModelExistsService } from '@contexts/knowledge-bases/application/services/read/assert-knowledge-base-view-model-exists/assert-knowledge-base-view-model-exists.service';

import { KnowledgeBaseGraphQLMapper } from '../mappers/knowledge-base/knowledge-base.mapper';
import { KnowledgeBaseQueriesResolver } from './knowledge-base-queries.resolver';

describe('KnowledgeBaseQueriesResolver', () => {
  let assertViewModelExists: jest.Mocked<AssertKnowledgeBaseViewModelExistsService>;
  let graphQLMapper: KnowledgeBaseGraphQLMapper;
  let resolver: KnowledgeBaseQueriesResolver;

  beforeEach(() => {
    assertViewModelExists = { execute: jest.fn() } as any;
    graphQLMapper = new KnowledgeBaseGraphQLMapper();
    resolver = new KnowledgeBaseQueriesResolver(
      assertViewModelExists,
      graphQLMapper,
    );
  });

  it('resolves the caller’s own knowledge base with no id argument', async () => {
    assertViewModelExists.execute.mockResolvedValue({
      id: 'kb-1',
      name: 'Docs',
      description: null,
      apiKeyHash: 'a'.repeat(64),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await resolver.knowledgeBase('kb-1');

    expect(assertViewModelExists.execute).toHaveBeenCalledWith('kb-1');
    expect(result).not.toHaveProperty('apiKeyHash');
  });
});
