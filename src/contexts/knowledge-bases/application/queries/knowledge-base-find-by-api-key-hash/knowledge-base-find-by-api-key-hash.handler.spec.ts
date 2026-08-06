import { IKnowledgeBaseReadRepository } from '@contexts/knowledge-bases/domain/repositories/read/knowledge-base-read.repository';

import { KnowledgeBaseFindByApiKeyHashQuery } from './knowledge-base-find-by-api-key-hash.query';
import { KnowledgeBaseFindByApiKeyHashQueryHandler } from './knowledge-base-find-by-api-key-hash.handler';

describe('KnowledgeBaseFindByApiKeyHashQueryHandler', () => {
  let readRepository: jest.Mocked<IKnowledgeBaseReadRepository>;
  let handler: KnowledgeBaseFindByApiKeyHashQueryHandler;
  const hash = 'a'.repeat(64);

  beforeEach(() => {
    readRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      findByApiKeyHash: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new KnowledgeBaseFindByApiKeyHashQueryHandler(readRepository);
  });

  it('returns the matching view model', async () => {
    const vm = { id: 'kb-1' } as any;
    readRepository.findByApiKeyHash.mockResolvedValue(vm);

    const result = await handler.execute(
      new KnowledgeBaseFindByApiKeyHashQuery({ hash }),
    );

    expect(result).toBe(vm);
    expect(readRepository.findByApiKeyHash).toHaveBeenCalledWith(hash);
  });

  it('returns null when no knowledge base matches', async () => {
    readRepository.findByApiKeyHash.mockResolvedValue(null);

    const result = await handler.execute(
      new KnowledgeBaseFindByApiKeyHashQuery({ hash }),
    );

    expect(result).toBeNull();
  });
});
