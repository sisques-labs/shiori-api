import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DocumentContentValueObject } from '@contexts/documents/domain/value-objects/document-content/document-content.value-object';
import { DocumentFailureReasonValueObject } from '@contexts/documents/domain/value-objects/document-failure-reason/document-failure-reason.value-object';
import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';
import { DocumentStatusValueObject } from '@contexts/documents/domain/value-objects/document-status/document-status.value-object';
import { DocumentTitleValueObject } from '@contexts/documents/domain/value-objects/document-title/document-title.value-object';

export interface IDocument {
  id: DocumentIdValueObject;
  knowledgeBaseId: UuidValueObject;
  title: DocumentTitleValueObject;
  content: DocumentContentValueObject;
  status: DocumentStatusValueObject;
  failureReason: DocumentFailureReasonValueObject | null;
  chunkCount: number;
  createdAt: DateValueObject;
  updatedAt: DateValueObject;
}
