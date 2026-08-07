import { BaseException } from '@sisques-labs/nestjs-kit';

export class KnowledgeBaseNotFoundException extends BaseException {
  constructor(id: string) {
    super(`Knowledge base with id '${id}' was not found`);
  }
}
