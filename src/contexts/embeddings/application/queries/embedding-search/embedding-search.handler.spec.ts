import { IEmbeddingPort } from '@contexts/embeddings/application/ports/embedding.port';
import {
  IEmbeddingReadRepository,
  IEmbeddingSearchResult,
} from '@contexts/embeddings/domain/repositories/read/embedding-read.repository';

import { EmbeddingSearchQuery } from './embedding-search.query';
import { EmbeddingSearchQueryHandler } from './embedding-search.handler';

function buildHandler() {
  const embeddingPort: jest.Mocked<IEmbeddingPort> = {
    embed: jest.fn(),
    embedBatch: jest.fn(),
  };
  const readRepository: jest.Mocked<IEmbeddingReadRepository> = {
    search: jest.fn(),
    findById: jest.fn(),
    findByCriteria: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const handler = new EmbeddingSearchQueryHandler(
    embeddingPort,
    readRepository,
  );

  return { handler, embeddingPort, readRepository };
}

const RESULT: IEmbeddingSearchResult = {
  chunkId: 'chunk-1',
  documentId: 'doc-1',
  chunkText: 'text',
  chunkPosition: 0,
  score: 0.9,
};

describe('EmbeddingSearchQueryHandler', () => {
  it('embeds the text and delegates to the read repository with the given topK', async () => {
    const { handler, embeddingPort, readRepository } = buildHandler();
    embeddingPort.embed.mockResolvedValue([0.1, 0.2, 0.3]);
    readRepository.search.mockResolvedValue([RESULT]);

    const result = await handler.execute(
      new EmbeddingSearchQuery({ text: 'hello', topK: 5 }),
    );

    expect(embeddingPort.embed).toHaveBeenCalledWith('hello');
    expect(readRepository.search).toHaveBeenCalledWith([0.1, 0.2, 0.3], 5);
    expect(result).toEqual([RESULT]);
  });
});
