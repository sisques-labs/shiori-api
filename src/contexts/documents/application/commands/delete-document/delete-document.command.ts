import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';

export interface DeleteDocumentCommandInput {
  id: string;
}

export class DeleteDocumentCommand {
  public readonly id: DocumentIdValueObject;

  constructor(input: DeleteDocumentCommandInput) {
    this.id = new DocumentIdValueObject(input.id);
  }
}
