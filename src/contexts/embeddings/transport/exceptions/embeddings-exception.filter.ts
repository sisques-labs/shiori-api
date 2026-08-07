import { HttpStatus } from '@nestjs/common';
import {
  BaseException,
  InvalidVectorException,
} from '@sisques-labs/nestjs-kit';

export function resolveEmbeddingsExceptionStatus(
  exception: BaseException,
): HttpStatus | undefined {
  if (exception instanceof InvalidVectorException) {
    return HttpStatus.UNPROCESSABLE_ENTITY;
  }
  return undefined;
}
