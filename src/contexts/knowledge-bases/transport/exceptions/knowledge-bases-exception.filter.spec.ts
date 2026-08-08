import { HttpStatus } from '@nestjs/common';
import { BaseException } from '@sisques-labs/nestjs-kit';

import { InvalidEmbeddingModelException } from '@contexts/knowledge-bases/domain/exceptions/invalid-embedding-model.exception';
import { InvalidKnowledgeBaseApiKeyHashException } from '@contexts/knowledge-bases/domain/exceptions/invalid-knowledge-base-api-key-hash.exception';
import { KnowledgeBaseNotFoundException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-not-found.exception';
import { KnowledgeBaseReembeddingInProgressException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-reembedding-in-progress.exception';
import { KnowledgeBaseUnauthorizedException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-unauthorized.exception';

import { resolveKnowledgeBasesExceptionStatus } from './knowledge-bases-exception.filter';

class SomeOtherException extends BaseException {
  constructor() {
    super('unrelated');
  }
}

describe('resolveKnowledgeBasesExceptionStatus', () => {
  it('maps KnowledgeBaseNotFoundException to 404', () => {
    expect(
      resolveKnowledgeBasesExceptionStatus(
        new KnowledgeBaseNotFoundException('kb-1'),
      ),
    ).toBe(HttpStatus.NOT_FOUND);
  });

  it('maps KnowledgeBaseUnauthorizedException to 401', () => {
    expect(
      resolveKnowledgeBasesExceptionStatus(
        new KnowledgeBaseUnauthorizedException(),
      ),
    ).toBe(HttpStatus.UNAUTHORIZED);
  });

  it('maps InvalidKnowledgeBaseApiKeyHashException to 422', () => {
    expect(
      resolveKnowledgeBasesExceptionStatus(
        new InvalidKnowledgeBaseApiKeyHashException(),
      ),
    ).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('maps InvalidEmbeddingModelException to 400', () => {
    expect(
      resolveKnowledgeBasesExceptionStatus(
        new InvalidEmbeddingModelException('not-a-model'),
      ),
    ).toBe(HttpStatus.BAD_REQUEST);
  });

  it('maps KnowledgeBaseReembeddingInProgressException to 409', () => {
    expect(
      resolveKnowledgeBasesExceptionStatus(
        new KnowledgeBaseReembeddingInProgressException('kb-1'),
      ),
    ).toBe(HttpStatus.CONFLICT);
  });

  it('returns undefined for an unrecognized exception', () => {
    expect(
      resolveKnowledgeBasesExceptionStatus(new SomeOtherException()),
    ).toBeUndefined();
  });
});
