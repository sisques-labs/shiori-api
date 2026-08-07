import { IKnowledgeBaseReadRepository } from '@contexts/knowledge-bases/domain/repositories/read/knowledge-base-read.repository';

import { KnowledgeBaseFindByIdQuery } from './knowledge-base-find-by-id.query';
import { KnowledgeBaseFindByIdQueryHandler } from './knowledge-base-find-by-id.handler';

describe('KnowledgeBaseFindByIdQueryHandler', () => {
  let readRepository: jest.Mocked<IKnowledgeBaseReadRepository>;
  let handler: KnowledgeBaseFindByIdQueryHandler;

  beforeEach(() => {
    readRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      findByApiKeyHash: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new KnowledgeBaseFindByIdQueryHandler(readRepository);
  });

  it('returns the view model when found', async () => {
    const viewModel = { id: 'kb-1' } as any;
    readRepository.findById.mockResolvedValue(viewModel);

    const result = await handler.execute(
      new KnowledgeBaseFindByIdQuery({ id: 'kb-1' }),
    );

    expect(result).toBe(viewModel);
  });

  it('returns null when not found', async () => {
    readRepository.findById.mockResolvedValue(null);

    const result = await handler.execute(
      new KnowledgeBaseFindByIdQuery({ id: 'kb-1' }),
    );

    expect(result).toBeNull();
  });
});
