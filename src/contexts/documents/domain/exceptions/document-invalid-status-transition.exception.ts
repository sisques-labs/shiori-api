import { BaseException } from '@sisques-labs/nestjs-kit';

export class DocumentInvalidStatusTransitionException extends BaseException {
  constructor(from: string, to: string) {
    super(`Document cannot transition from '${from}' to '${to}'`);
  }
}
