import { HttpStatus } from '@nestjs/common';
import { BaseException } from '@sisques-labs/nestjs-kit';

import { InvalidKnowledgeBaseEmbeddingModelException } from '@contexts/knowledge-bases/domain/exceptions/invalid-knowledge-base-embedding-model.exception';
import { InvalidKnowledgeBaseApiKeyHashException } from '@contexts/knowledge-bases/domain/exceptions/invalid-knowledge-base-api-key-hash.exception';
import { KnowledgeBaseNotFoundException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-not-found.exception';
import { KnowledgeBaseReembeddingInProgressException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-reembedding-in-progress.exception';
import { KnowledgeBaseUnauthorizedException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-unauthorized.exception';

export function resolveKnowledgeBasesExceptionStatus(
  exception: BaseException,
): HttpStatus | undefined {
  if (exception instanceof KnowledgeBaseNotFoundException) {
    return HttpStatus.NOT_FOUND;
  }
  if (exception instanceof KnowledgeBaseUnauthorizedException) {
    return HttpStatus.UNAUTHORIZED;
  }
  if (exception instanceof InvalidKnowledgeBaseApiKeyHashException) {
    return HttpStatus.UNPROCESSABLE_ENTITY;
  }
  if (exception instanceof InvalidKnowledgeBaseEmbeddingModelException) {
    return HttpStatus.BAD_REQUEST;
  }
  if (exception instanceof KnowledgeBaseReembeddingInProgressException) {
    return HttpStatus.CONFLICT;
  }
  return undefined;
}
