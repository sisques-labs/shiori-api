import { BaseException } from '@sisques-labs/nestjs-kit';

export class InvalidKnowledgeBaseApiKeyHashException extends BaseException {
  constructor() {
    super(
      'KnowledgeBaseApiKeyHash must be exactly 64 lowercase hex characters (SHA-256)',
    );
  }
}
