import { KnowledgeBaseNotFoundException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-not-found.exception';
import { IKnowledgeBaseReadRepository } from '@contexts/knowledge-bases/domain/repositories/read/knowledge-base-read.repository';

import { AssertKnowledgeBaseViewModelExistsService } from './assert-knowledge-base-view-model-exists.service';

describe('AssertKnowledgeBaseViewModelExistsService', () => {
  let readRepository: jest.Mocked<IKnowledgeBaseReadRepository>;
  let service: AssertKnowledgeBaseViewModelExistsService;

  beforeEach(() => {
    readRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      findByApiKeyHash: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    service = new AssertKnowledgeBaseViewModelExistsService(readRepository);
  });

  it('returns the view model when found', async () => {
    const vm = { id: 'kb-1' } as any;
    readRepository.findById.mockResolvedValue(vm);

    await expect(service.execute('kb-1')).resolves.toBe(vm);
  });

  it('throws KnowledgeBaseNotFoundException when not found', async () => {
    readRepository.findById.mockResolvedValue(null);

    await expect(service.execute('kb-1')).rejects.toThrow(
      KnowledgeBaseNotFoundException,
    );
  });
});
