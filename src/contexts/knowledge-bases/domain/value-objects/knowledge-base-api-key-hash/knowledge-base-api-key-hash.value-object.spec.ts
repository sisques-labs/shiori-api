import { InvalidKnowledgeBaseApiKeyHashException } from '@contexts/knowledge-bases/domain/exceptions/invalid-knowledge-base-api-key-hash.exception';

import { KnowledgeBaseApiKeyHashValueObject } from './knowledge-base-api-key-hash.value-object';

describe('KnowledgeBaseApiKeyHashValueObject', () => {
  const validHash = 'a'.repeat(64);

  it('accepts a 64-character lowercase hex string', () => {
    expect(new KnowledgeBaseApiKeyHashValueObject(validHash).value).toBe(
      validHash,
    );
  });

  it('rejects a string shorter than 64 characters', () => {
    expect(
      () => new KnowledgeBaseApiKeyHashValueObject('a'.repeat(63)),
    ).toThrow(InvalidKnowledgeBaseApiKeyHashException);
  });

  it('rejects a non-hex string', () => {
    expect(
      () => new KnowledgeBaseApiKeyHashValueObject('z'.repeat(64)),
    ).toThrow(InvalidKnowledgeBaseApiKeyHashException);
  });

  it('rejects uppercase hex characters', () => {
    expect(
      () => new KnowledgeBaseApiKeyHashValueObject('A'.repeat(64)),
    ).toThrow(InvalidKnowledgeBaseApiKeyHashException);
  });

  it('rejects an empty string', () => {
    expect(() => new KnowledgeBaseApiKeyHashValueObject('')).toThrow(
      InvalidKnowledgeBaseApiKeyHashException,
    );
  });
});
