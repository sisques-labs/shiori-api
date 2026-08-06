import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { IEmbeddingWriteRepository } from '@contexts/retrieval/domain/repositories/write/embedding-write.repository';

import { DeleteEmbeddingsByKnowledgeBaseCommand } from './delete-embeddings-by-knowledge-base.command';
import { DeleteEmbeddingsByKnowledgeBaseCommandHandler } from './delete-embeddings-by-knowledge-base.handler';

describe('DeleteEmbeddingsByKnowledgeBaseCommandHandler', () => {
  let writeRepository: jest.Mocked<IEmbeddingWriteRepository>;
  let handler: DeleteEmbeddingsByKnowledgeBaseCommandHandler;

  beforeEach(() => {
    writeRepository = {
      saveMany: jest.fn(),
      deleteByDocumentId: jest.fn(),
      deleteByKnowledgeBaseId: jest.fn().mockResolvedValue(undefined),
    };

    handler = new DeleteEmbeddingsByKnowledgeBaseCommandHandler(
      writeRepository,
    );
  });

  it('deletes embeddings for the given knowledge base', async () => {
    const knowledgeBaseId = UuidValueObject.generate().value;
    const command = new DeleteEmbeddingsByKnowledgeBaseCommand({
      knowledgeBaseId,
    });

    await handler.execute(command);

    expect(writeRepository.deleteByKnowledgeBaseId).toHaveBeenCalledWith(
      knowledgeBaseId,
    );
    expect(writeRepository.deleteByDocumentId).not.toHaveBeenCalled();
  });
});
