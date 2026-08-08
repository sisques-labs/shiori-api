import { HttpStatus } from '@nestjs/common';
import {
  BaseException,
  InvalidVectorException,
} from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseNotReadyForSearchException } from '@contexts/embeddings/domain/exceptions/knowledge-base-not-ready-for-search.exception';
import { NoEmbeddingTableForDimensionException } from '@contexts/embeddings/domain/exceptions/no-embedding-table-for-dimension.exception';
import { UnknownEmbeddingModelException } from '@contexts/embeddings/domain/exceptions/unknown-embedding-model.exception';

export function resolveEmbeddingsExceptionStatus(
  exception: BaseException,
): HttpStatus | undefined {
  if (exception instanceof InvalidVectorException) {
    return HttpStatus.UNPROCESSABLE_ENTITY;
  }
  if (exception instanceof KnowledgeBaseNotReadyForSearchException) {
    return HttpStatus.CONFLICT;
  }
  if (exception instanceof UnknownEmbeddingModelException) {
    return HttpStatus.BAD_REQUEST;
  }
  if (exception instanceof NoEmbeddingTableForDimensionException) {
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
  return undefined;
}
