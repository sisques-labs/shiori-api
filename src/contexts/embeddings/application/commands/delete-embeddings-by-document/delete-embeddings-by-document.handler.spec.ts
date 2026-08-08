import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { IEmbeddingWriteRepository } from '@contexts/embeddings/domain/repositories/write/embedding-write.repository';

import { DeleteEmbeddingsByDocumentCommand } from './delete-embeddings-by-document.command';
import { DeleteEmbeddingsByDocumentCommandHandler } from './delete-embeddings-by-document.handler';

describe('DeleteEmbeddingsByDocumentCommandHandler', () => {
  let writeRepository: jest.Mocked<IEmbeddingWriteRepository>;
  let handler: DeleteEmbeddingsByDocumentCommandHandler;

  beforeEach(() => {
    writeRepository = {
      saveMany: jest.fn(),
      deleteByDocumentId: jest.fn().mockResolvedValue(undefined),
      deleteByKnowledgeBaseId: jest.fn(),
      deleteByKnowledgeBaseIdAndModel: jest.fn(),
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    handler = new DeleteEmbeddingsByDocumentCommandHandler(writeRepository);
  });

  it('deletes embeddings for the given document', async () => {
    const documentId = UuidValueObject.generate().value;
    const command = new DeleteEmbeddingsByDocumentCommand({ documentId });

    await handler.execute(command);

    expect(writeRepository.deleteByDocumentId).toHaveBeenCalledWith(documentId);
    expect(writeRepository.deleteByKnowledgeBaseId).not.toHaveBeenCalled();
  });
});
