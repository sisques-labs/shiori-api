import { HttpStatus } from '@nestjs/common';
import { BaseException } from '@sisques-labs/nestjs-kit';

import { DocumentContentTooLargeException } from '@contexts/documents/domain/exceptions/document-content-too-large.exception';
import { DocumentInvalidStatusTransitionException } from '@contexts/documents/domain/exceptions/document-invalid-status-transition.exception';
import { DocumentNotFoundException } from '@contexts/documents/domain/exceptions/document-not-found.exception';
import { DocumentTooManyChunksException } from '@contexts/documents/domain/exceptions/document-too-many-chunks.exception';

export function resolveDocumentsExceptionStatus(
  exception: BaseException,
): HttpStatus | undefined {
  if (exception instanceof DocumentNotFoundException) {
    return HttpStatus.NOT_FOUND;
  }
  if (exception instanceof DocumentContentTooLargeException) {
    return HttpStatus.PAYLOAD_TOO_LARGE;
  }
  if (
    exception instanceof DocumentInvalidStatusTransitionException ||
    exception instanceof DocumentTooManyChunksException
  ) {
    return HttpStatus.UNPROCESSABLE_ENTITY;
  }
  return undefined;
}
