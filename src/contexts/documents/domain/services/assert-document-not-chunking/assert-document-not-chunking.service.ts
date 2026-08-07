import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentInvalidStatusTransitionException } from '@contexts/documents/domain/exceptions/document-invalid-status-transition.exception';

/**
 * Plain domain service, not IBaseService — called synchronously from inside
 * DocumentAggregate.update() so the aggregate keeps protecting its own
 * invariant regardless of caller. IBaseService's async execute() would force
 * update() to become async, breaking every existing synchronous caller.
 */
export class AssertDocumentNotChunkingService {
  execute(status: string): void {
    if (status === DocumentStatusEnum.CHUNKING) {
      throw new DocumentInvalidStatusTransitionException(
        status,
        'updated-while-chunking',
      );
    }
  }
}
