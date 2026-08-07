import { BaseException } from '@sisques-labs/nestjs-kit';

export class KnowledgeBaseUnauthorizedException extends BaseException {
  constructor() {
    super('Missing or invalid X-API-Key');
  }
}
