import { QueryBus } from '@nestjs/cqrs';

import { EmbeddingSearchQuery } from '@contexts/embeddings/application/queries/embedding-search/embedding-search.query';
import { IEmbeddingSearchResult } from '@contexts/embeddings/domain/repositories/read/embedding-read.repository';

import { EmbeddingSearchAdapter } from './embedding-search.adapter';

describe('EmbeddingSearchAdapter', () => {
  let queryBus: jest.Mocked<QueryBus>;
  let adapter: EmbeddingSearchAdapter;

  beforeEach(() => {
    queryBus = { execute: jest.fn() } as unknown as jest.Mocked<QueryBus>;
    adapter = new EmbeddingSearchAdapter(queryBus);
  });

  it('dispatches an EmbeddingSearchQuery and maps the result', async () => {
    const results: IEmbeddingSearchResult[] = [
      {
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        chunkText: 'text',
        chunkPosition: 0,
        score: 0.9,
      },
    ];
    queryBus.execute.mockResolvedValue(results);

    const found = await adapter.search('hello', 5);

    expect(queryBus.execute).toHaveBeenCalledWith(
      expect.any(EmbeddingSearchQuery),
    );
    const dispatchedQuery = queryBus.execute.mock
      .calls[0][0] as EmbeddingSearchQuery;
    expect(dispatchedQuery.text).toBe('hello');
    expect(dispatchedQuery.topK).toBe(5);

    expect(found).toEqual(results);
  });

  it('returns an empty array when there are no matches', async () => {
    queryBus.execute.mockResolvedValue([]);

    const found = await adapter.search('hello', 5);

    expect(found).toEqual([]);
  });
});
