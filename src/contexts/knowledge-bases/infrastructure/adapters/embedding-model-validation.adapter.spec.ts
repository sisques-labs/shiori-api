import { QueryBus } from '@nestjs/cqrs';

import { EmbeddingModelExistsQuery } from '@contexts/embeddings/application/queries/embedding-model-exists/embedding-model-exists.query';

import { EmbeddingModelValidationAdapter } from './embedding-model-validation.adapter';

describe('EmbeddingModelValidationAdapter', () => {
  let queryBus: jest.Mocked<QueryBus>;
  let adapter: EmbeddingModelValidationAdapter;

  beforeEach(() => {
    queryBus = { execute: jest.fn() } as unknown as jest.Mocked<QueryBus>;
    adapter = new EmbeddingModelValidationAdapter(queryBus);
  });

  it('dispatches EmbeddingModelExistsQuery and returns the result', async () => {
    queryBus.execute.mockResolvedValue(true);

    const result = await adapter.isValid('text-embedding-3-small');

    expect(queryBus.execute).toHaveBeenCalledWith(
      expect.any(EmbeddingModelExistsQuery),
    );
    const dispatchedQuery = queryBus.execute.mock
      .calls[0][0] as EmbeddingModelExistsQuery;
    expect(dispatchedQuery.modelId).toBe('text-embedding-3-small');
    expect(result).toBe(true);
  });

  it('returns false for an unknown model', async () => {
    queryBus.execute.mockResolvedValue(false);

    const result = await adapter.isValid('not-a-real-model');

    expect(result).toBe(false);
  });
});
