import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentInvalidStatusTransitionException } from '@contexts/documents/domain/exceptions/document-invalid-status-transition.exception';

import { AssertDocumentNotChunkingService } from './assert-document-not-chunking.service';

describe('AssertDocumentNotChunkingService', () => {
  const service = new AssertDocumentNotChunkingService();

  it('throws when the status is CHUNKING', () => {
    expect(() => service.execute(DocumentStatusEnum.CHUNKING)).toThrow(
      DocumentInvalidStatusTransitionException,
    );
  });

  it.each([
    DocumentStatusEnum.PENDING,
    DocumentStatusEnum.CHUNKED,
    DocumentStatusEnum.FAILED,
  ])('does not throw when the status is %s', (status) => {
    expect(() => service.execute(status)).not.toThrow();
  });
});
