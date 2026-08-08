import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { IChunkSourcePort } from '@contexts/embeddings/application/ports/chunk-source.port';
import { IEmbeddingPort } from '@contexts/embeddings/application/ports/embedding.port';
import { EmbeddingAggregate } from '@contexts/embeddings/domain/aggregates/embedding.aggregate';
import { EmbeddingBuilder } from '@contexts/embeddings/domain/builders/embedding.builder';
import { IEmbeddingWriteRepository } from '@contexts/embeddings/domain/repositories/write/embedding-write.repository';

import { EmbedDocumentChunksService } from './embed-document-chunks.service';

function vector(fill = 0.1, dimensions = 1536): number[] {
  return new Array(dimensions).fill(fill);
}

function buildService() {
  const chunkSource: jest.Mocked<IChunkSourcePort> = {
    findByDocumentId: jest.fn(),
    findKnowledgeBaseDocumentIds: jest.fn(),
  };
  const embeddingPort: jest.Mocked<IEmbeddingPort> = {
    embed: jest.fn(),
    embedBatch: jest.fn(),
  };
  const embeddingWriteRepository: jest.Mocked<IEmbeddingWriteRepository> = {
    saveMany: jest.fn().mockResolvedValue(undefined),
    deleteByDocumentId: jest.fn(),
    deleteByKnowledgeBaseId: jest.fn(),
    deleteByKnowledgeBaseIdAndModel: jest.fn(),
    findById: jest.fn(),
    findByCriteria: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const service = new EmbedDocumentChunksService(
    chunkSource,
    embeddingPort,
    embeddingWriteRepository,
    new EmbeddingBuilder(),
  );

  return { service, chunkSource, embeddingPort, embeddingWriteRepository };
}

describe('EmbedDocumentChunksService', () => {
  const documentId = UuidValueObject.generate().value;
  const knowledgeBaseId = UuidValueObject.generate().value;
  const chunkId1 = UuidValueObject.generate().value;
  const chunkId2 = UuidValueObject.generate().value;

  it('embeds every chunk of the document under the given model/dimensions and saves them', async () => {
    const { service, chunkSource, embeddingPort, embeddingWriteRepository } =
      buildService();
    chunkSource.findByDocumentId.mockResolvedValue([
      { id: chunkId1, text: 'first', position: 0 },
      { id: chunkId2, text: 'second', position: 1 },
    ]);
    embeddingPort.embedBatch.mockResolvedValue([vector(0.1), vector(0.2)]);

    const count = await service.execute(
      documentId,
      knowledgeBaseId,
      'text-embedding-3-small',
      1536,
    );

    expect(count).toBe(2);
    expect(embeddingPort.embedBatch).toHaveBeenCalledWith(
      ['first', 'second'],
      'text-embedding-3-small',
    );
    expect(embeddingWriteRepository.saveMany).toHaveBeenCalledTimes(1);
    const [saved, dimensions] = embeddingWriteRepository.saveMany.mock
      .calls[0] as [EmbeddingAggregate[], number];
    expect(dimensions).toBe(1536);
    expect(saved).toHaveLength(2);
    expect(saved[0].chunkId.value).toBe(chunkId1);
    expect(saved[0].model.value).toBe('text-embedding-3-small');
    expect(saved[1].chunkId.value).toBe(chunkId2);
  });

  it('returns 0 and does nothing when the document has no chunks', async () => {
    const { service, chunkSource, embeddingPort, embeddingWriteRepository } =
      buildService();
    chunkSource.findByDocumentId.mockResolvedValue([]);

    const count = await service.execute(
      documentId,
      knowledgeBaseId,
      'text-embedding-3-small',
      1536,
    );

    expect(count).toBe(0);
    expect(embeddingPort.embedBatch).not.toHaveBeenCalled();
    expect(embeddingWriteRepository.saveMany).not.toHaveBeenCalled();
  });
});
