import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { IChunkWriteRepository } from '@contexts/documents/domain/repositories/write/chunk-write.repository';
import { IDocumentWriteRepository } from '@contexts/documents/domain/repositories/write/document-write.repository';

import { DeleteDocumentsByKnowledgeBaseService } from './delete-documents-by-knowledge-base.service';

function buildDocument(id: string): DocumentAggregate {
  return { id: { value: id } } as unknown as DocumentAggregate;
}

describe('DeleteDocumentsByKnowledgeBaseService', () => {
  let writeRepository: jest.Mocked<IDocumentWriteRepository>;
  let chunkWriteRepository: jest.Mocked<IChunkWriteRepository>;
  let service: DeleteDocumentsByKnowledgeBaseService;

  beforeEach(() => {
    writeRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    chunkWriteRepository = {
      deleteByDocumentId: jest.fn().mockResolvedValue(undefined),
    } as any;

    service = new DeleteDocumentsByKnowledgeBaseService(
      writeRepository,
      chunkWriteRepository,
    );
  });

  it('deletes every document and its chunks across multiple pages', async () => {
    writeRepository.findByCriteria
      .mockResolvedValueOnce(
        new PaginatedResult(
          [buildDocument('doc-1'), buildDocument('doc-2')],
          2,
          1,
          100,
        ),
      )
      .mockResolvedValueOnce(new PaginatedResult([], 0, 1, 100));

    await service.execute('kb-1');

    expect(writeRepository.findByCriteria).toHaveBeenCalledTimes(2);
    expect(chunkWriteRepository.deleteByDocumentId).toHaveBeenCalledWith(
      'doc-1',
    );
    expect(chunkWriteRepository.deleteByDocumentId).toHaveBeenCalledWith(
      'doc-2',
    );
    expect(writeRepository.delete).toHaveBeenCalledWith('doc-1');
    expect(writeRepository.delete).toHaveBeenCalledWith('doc-2');
  });

  it('fetches once and deletes nothing when there are no documents', async () => {
    writeRepository.findByCriteria.mockResolvedValueOnce(
      new PaginatedResult([], 0, 1, 100),
    );

    await service.execute('kb-1');

    expect(writeRepository.findByCriteria).toHaveBeenCalledTimes(1);
    expect(writeRepository.delete).not.toHaveBeenCalled();
  });
});
