import { BaseException } from '@sisques-labs/nestjs-kit';

export class DocumentNotFoundException extends BaseException {
  constructor(id: string) {
    super(`Document with id '${id}' was not found`);
  }
}
