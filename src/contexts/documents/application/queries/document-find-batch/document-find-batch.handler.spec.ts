import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { IDocumentWriteRepository } from '@contexts/documents/domain/repositories/write/document-write.repository';

import { DocumentFindBatchQuery } from './document-find-batch.query';
import { DocumentFindBatchQueryHandler } from './document-find-batch.handler';

describe('DocumentFindBatchQueryHandler', () => {
  let writeRepository: jest.Mocked<IDocumentWriteRepository>;
  let handler: DocumentFindBatchQueryHandler;

  beforeEach(() => {
    writeRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new DocumentFindBatchQueryHandler(writeRepository);
  });

  it('delegates to findByCriteria with the requested page/perPage', async () => {
    const page = new PaginatedResult<DocumentAggregate>([], 0, 2, 50);
    writeRepository.findByCriteria.mockResolvedValue(page);

    const result = await handler.execute(
      new DocumentFindBatchQuery({ page: 2, perPage: 50 }),
    );

    expect(result).toBe(page);
    expect(writeRepository.findByCriteria).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: { page: 2, perPage: 50 },
      }),
    );
  });
});
