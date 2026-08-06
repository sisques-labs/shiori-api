import { ConfigService } from '@nestjs/config';

import { IEmbeddingPort } from '@contexts/retrieval/application/ports/embedding.port';
import {
  IEmbeddingReadRepository,
  IRetrievalSearchResult,
} from '@contexts/retrieval/domain/repositories/read/embedding-read.repository';

import { RetrievalSearchQuery } from './retrieval-search.query';
import { RetrievalSearchQueryHandler } from './retrieval-search.handler';

function buildHandler(config: {
  searchTopKDefault: number;
  searchTopKMax: number;
}) {
  const embeddingPort: jest.Mocked<IEmbeddingPort> = {
    embed: jest.fn(),
    embedBatch: jest.fn(),
  };
  const readRepository: jest.Mocked<IEmbeddingReadRepository> = {
    search: jest.fn(),
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(config),
  } as unknown as ConfigService;

  const handler = new RetrievalSearchQueryHandler(
    embeddingPort,
    readRepository,
    configService,
  );

  return { handler, embeddingPort, readRepository };
}

const RESULT: IRetrievalSearchResult = {
  chunkId: 'chunk-1',
  documentId: 'doc-1',
  chunkText: 'text',
  chunkPosition: 0,
  score: 0.9,
};

describe('RetrievalSearchQueryHandler', () => {
  it('embeds the query and delegates to the read repository', async () => {
    const { handler, embeddingPort, readRepository } = buildHandler({
      searchTopKDefault: 5,
      searchTopKMax: 20,
    });
    embeddingPort.embed.mockResolvedValue([0.1, 0.2, 0.3]);
    readRepository.search.mockResolvedValue([RESULT]);

    const result = await handler.execute(
      new RetrievalSearchQuery({ query: 'hello' }),
    );

    expect(embeddingPort.embed).toHaveBeenCalledWith('hello');
    expect(readRepository.search).toHaveBeenCalledWith([0.1, 0.2, 0.3], 5);
    expect(result).toEqual([RESULT]);
  });

  it('uses searchTopKDefault when topK is omitted', async () => {
    const { handler, embeddingPort, readRepository } = buildHandler({
      searchTopKDefault: 7,
      searchTopKMax: 20,
    });
    embeddingPort.embed.mockResolvedValue([]);
    readRepository.search.mockResolvedValue([]);

    await handler.execute(new RetrievalSearchQuery({ query: 'hello' }));

    expect(readRepository.search).toHaveBeenCalledWith([], 7);
  });

  it('clamps a requested topK above searchTopKMax', async () => {
    const { handler, embeddingPort, readRepository } = buildHandler({
      searchTopKDefault: 5,
      searchTopKMax: 20,
    });
    embeddingPort.embed.mockResolvedValue([]);
    readRepository.search.mockResolvedValue([]);

    await handler.execute(
      new RetrievalSearchQuery({ query: 'hello', topK: 999 }),
    );

    expect(readRepository.search).toHaveBeenCalledWith([], 20);
  });

  it('honors a requested topK within bounds', async () => {
    const { handler, embeddingPort, readRepository } = buildHandler({
      searchTopKDefault: 5,
      searchTopKMax: 20,
    });
    embeddingPort.embed.mockResolvedValue([]);
    readRepository.search.mockResolvedValue([]);

    await handler.execute(
      new RetrievalSearchQuery({ query: 'hello', topK: 3 }),
    );

    expect(readRepository.search).toHaveBeenCalledWith([], 3);
  });
});
