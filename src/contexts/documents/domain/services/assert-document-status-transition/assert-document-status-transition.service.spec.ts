import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentInvalidStatusTransitionException } from '@contexts/documents/domain/exceptions/document-invalid-status-transition.exception';

import { AssertDocumentStatusTransitionService } from './assert-document-status-transition.service';

describe('AssertDocumentStatusTransitionService', () => {
  const service = new AssertDocumentStatusTransitionService();

  it('does not throw when current matches expectedFrom', () => {
    expect(() =>
      service.execute(
        DocumentStatusEnum.PENDING,
        DocumentStatusEnum.PENDING,
        DocumentStatusEnum.CHUNKING,
      ),
    ).not.toThrow();
  });

  it('throws when current does not match expectedFrom', () => {
    expect(() =>
      service.execute(
        DocumentStatusEnum.CHUNKED,
        DocumentStatusEnum.PENDING,
        DocumentStatusEnum.CHUNKING,
      ),
    ).toThrow(DocumentInvalidStatusTransitionException);
  });
});
