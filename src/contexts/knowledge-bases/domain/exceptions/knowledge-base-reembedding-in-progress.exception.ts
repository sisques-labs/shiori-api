import { BaseException } from '@sisques-labs/nestjs-kit';

export class KnowledgeBaseReembeddingInProgressException extends BaseException {
  constructor(id: string) {
    super(`Knowledge base '${id}' is already re-embedding`);
  }
}
