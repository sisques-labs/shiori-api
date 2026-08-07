import { ConfigService } from '@nestjs/config';

import {
  IEmbeddingSearchPort,
  IRetrievalSearchResult,
} from '@contexts/retrieval/application/ports/embedding-search.port';

import { RetrievalSearchQuery } from './retrieval-search.query';
import { RetrievalSearchQueryHandler } from './retrieval-search.handler';

function buildHandler(config: {
  searchTopKDefault: number;
  searchTopKMax: number;
}) {
  const embeddingSearchPort: jest.Mocked<IEmbeddingSearchPort> = {
    search: jest.fn(),
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(config),
  } as unknown as ConfigService;

  const handler = new RetrievalSearchQueryHandler(
    embeddingSearchPort,
    configService,
  );

  return { handler, embeddingSearchPort };
}

const RESULT: IRetrievalSearchResult = {
  chunkId: 'chunk-1',
  documentId: 'doc-1',
  chunkText: 'text',
  chunkPosition: 0,
  score: 0.9,
};

describe('RetrievalSearchQueryHandler', () => {
  it('delegates to the embedding search port', async () => {
    const { handler, embeddingSearchPort } = buildHandler({
      searchTopKDefault: 5,
      searchTopKMax: 20,
    });
    embeddingSearchPort.search.mockResolvedValue([RESULT]);

    const result = await handler.execute(
      new RetrievalSearchQuery({ query: 'hello' }),
    );

    expect(embeddingSearchPort.search).toHaveBeenCalledWith('hello', 5);
    expect(result).toEqual([RESULT]);
  });

  it('uses searchTopKDefault when topK is omitted', async () => {
    const { handler, embeddingSearchPort } = buildHandler({
      searchTopKDefault: 7,
      searchTopKMax: 20,
    });
    embeddingSearchPort.search.mockResolvedValue([]);

    await handler.execute(new RetrievalSearchQuery({ query: 'hello' }));

    expect(embeddingSearchPort.search).toHaveBeenCalledWith('hello', 7);
  });

  it('clamps a requested topK above searchTopKMax', async () => {
    const { handler, embeddingSearchPort } = buildHandler({
      searchTopKDefault: 5,
      searchTopKMax: 20,
    });
    embeddingSearchPort.search.mockResolvedValue([]);

    await handler.execute(
      new RetrievalSearchQuery({ query: 'hello', topK: 999 }),
    );

    expect(embeddingSearchPort.search).toHaveBeenCalledWith('hello', 20);
  });

  it('honors a requested topK within bounds', async () => {
    const { handler, embeddingSearchPort } = buildHandler({
      searchTopKDefault: 5,
      searchTopKMax: 20,
    });
    embeddingSearchPort.search.mockResolvedValue([]);

    await handler.execute(
      new RetrievalSearchQuery({ query: 'hello', topK: 3 }),
    );

    expect(embeddingSearchPort.search).toHaveBeenCalledWith('hello', 3);
  });
});
