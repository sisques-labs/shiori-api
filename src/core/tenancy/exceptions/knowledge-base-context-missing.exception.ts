import { BaseException } from '@sisques-labs/nestjs-kit';

export class KnowledgeBaseContextMissingException extends BaseException {
  constructor() {
    super(
      'KnowledgeBaseContext.require() called outside a request scoped by KnowledgeBaseContextInterceptor',
    );
  }
}
