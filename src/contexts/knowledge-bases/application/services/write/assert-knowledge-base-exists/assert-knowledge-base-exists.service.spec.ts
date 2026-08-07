import { KnowledgeBaseNotFoundException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-not-found.exception';
import { IKnowledgeBaseWriteRepository } from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';

import { AssertKnowledgeBaseExistsService } from './assert-knowledge-base-exists.service';

describe('AssertKnowledgeBaseExistsService', () => {
  let writeRepository: jest.Mocked<IKnowledgeBaseWriteRepository>;
  let service: AssertKnowledgeBaseExistsService;
  const id =
    KnowledgeBaseIdValueObject.generate() as KnowledgeBaseIdValueObject;

  beforeEach(() => {
    writeRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    service = new AssertKnowledgeBaseExistsService(writeRepository);
  });

  it('returns the aggregate when found', async () => {
    const aggregate = { id } as any;
    writeRepository.findById.mockResolvedValue(aggregate);

    await expect(service.execute(id)).resolves.toBe(aggregate);
  });

  it('throws KnowledgeBaseNotFoundException when not found', async () => {
    writeRepository.findById.mockResolvedValue(null);

    await expect(service.execute(id)).rejects.toThrow(
      KnowledgeBaseNotFoundException,
    );
  });
});
