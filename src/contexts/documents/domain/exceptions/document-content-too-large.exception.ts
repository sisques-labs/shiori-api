import { BaseException } from '@sisques-labs/nestjs-kit';

export class DocumentContentTooLargeException extends BaseException {
  constructor(length: number, maxLength: number) {
    super(
      `Document content length ${length} exceeds the maximum of ${maxLength} characters`,
    );
  }
}
