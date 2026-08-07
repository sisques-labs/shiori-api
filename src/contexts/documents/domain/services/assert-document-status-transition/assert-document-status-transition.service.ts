import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentInvalidStatusTransitionException } from '@contexts/documents/domain/exceptions/document-invalid-status-transition.exception';

/**
 * Plain domain service, not IBaseService — called synchronously from inside
 * DocumentAggregate's status-transition methods (startChunking,
 * completeChunking, failChunking) so the aggregate keeps protecting its own
 * state machine regardless of caller. IBaseService's async execute() would
 * force those methods to become async, breaking every existing synchronous
 * caller and turning a synchronous throw into an unhandled rejection risk.
 */
export class AssertDocumentStatusTransitionService {
  execute(
    current: string,
    expectedFrom: DocumentStatusEnum,
    to: DocumentStatusEnum,
  ): void {
    if (current !== expectedFrom) {
      throw new DocumentInvalidStatusTransitionException(current, to);
    }
  }
}
