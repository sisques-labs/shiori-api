import { HttpStatus } from '@nestjs/common';
import { BaseException } from '@sisques-labs/nestjs-kit';

import { InvalidEmbeddingVectorDimensionException } from '@contexts/retrieval/domain/exceptions/invalid-embedding-vector-dimension.exception';

export function resolveRetrievalExceptionStatus(
  exception: BaseException,
): HttpStatus | undefined {
  if (exception instanceof InvalidEmbeddingVectorDimensionException) {
    return HttpStatus.UNPROCESSABLE_ENTITY;
  }
  return undefined;
}
