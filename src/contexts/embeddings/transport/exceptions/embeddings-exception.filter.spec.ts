import { HttpStatus } from '@nestjs/common';
import {
  BaseException,
  InvalidVectorException,
} from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseNotReadyForSearchException } from '@contexts/embeddings/domain/exceptions/knowledge-base-not-ready-for-search.exception';
import { NoEmbeddingTableForDimensionException } from '@contexts/embeddings/domain/exceptions/no-embedding-table-for-dimension.exception';
import { UnknownEmbeddingModelException } from '@contexts/embeddings/domain/exceptions/unknown-embedding-model.exception';

import { resolveEmbeddingsExceptionStatus } from './embeddings-exception.filter';

class SomeOtherException extends BaseException {
  constructor() {
    super('unrelated');
  }
}

describe('resolveEmbeddingsExceptionStatus', () => {
  it('maps InvalidVectorException to 422', () => {
    expect(
      resolveEmbeddingsExceptionStatus(new InvalidVectorException('bad')),
    ).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('maps KnowledgeBaseNotReadyForSearchException to 409', () => {
    expect(
      resolveEmbeddingsExceptionStatus(
        new KnowledgeBaseNotReadyForSearchException('kb-1', 'REEMBEDDING'),
      ),
    ).toBe(HttpStatus.CONFLICT);
  });

  it('maps UnknownEmbeddingModelException to 400', () => {
    expect(
      resolveEmbeddingsExceptionStatus(
        new UnknownEmbeddingModelException('not-a-model'),
      ),
    ).toBe(HttpStatus.BAD_REQUEST);
  });

  it('maps NoEmbeddingTableForDimensionException to 500', () => {
    expect(
      resolveEmbeddingsExceptionStatus(
        new NoEmbeddingTableForDimensionException(42),
      ),
    ).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('returns undefined for an unrecognized exception', () => {
    expect(
      resolveEmbeddingsExceptionStatus(new SomeOtherException()),
    ).toBeUndefined();
  });
});
