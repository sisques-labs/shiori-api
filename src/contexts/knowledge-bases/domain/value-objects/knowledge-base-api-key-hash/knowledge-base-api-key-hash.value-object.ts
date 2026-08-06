import { InvalidKnowledgeBaseApiKeyHashException } from '@contexts/knowledge-bases/domain/exceptions/invalid-knowledge-base-api-key-hash.exception';
import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class KnowledgeBaseApiKeyHashValueObject extends StringValueObject {
  constructor(value: string) {
    super(value);
    this.assertValidHash(value);
  }

  private assertValidHash(value: string): void {
    if (!value || value.length === 0)
      throw new InvalidKnowledgeBaseApiKeyHashException();
    if (!/^[0-9a-f]{64}$/.test(value))
      throw new InvalidKnowledgeBaseApiKeyHashException();
  }
}
