import { IDocumentPrimitives } from '@contexts/documents/domain/primitives/document.primitives';
import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';

export type DeleteDocumentCommandInput = Pick<IDocumentPrimitives, 'id'>;

export class DeleteDocumentCommand {
  public readonly id: DocumentIdValueObject;

  constructor(input: DeleteDocumentCommandInput) {
    this.id = new DocumentIdValueObject(input.id);
  }
}
