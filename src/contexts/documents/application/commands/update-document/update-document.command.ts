import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';
import { DocumentContentValueObject } from '@contexts/documents/domain/value-objects/document-content/document-content.value-object';
import { DocumentTitleValueObject } from '@contexts/documents/domain/value-objects/document-title/document-title.value-object';

export interface UpdateDocumentCommandInput {
  id: string;
  title?: string;
  content?: string;
}

export class UpdateDocumentCommand {
  public readonly id: DocumentIdValueObject;
  public readonly title?: DocumentTitleValueObject;
  public readonly content?: DocumentContentValueObject;

  constructor(input: UpdateDocumentCommandInput) {
    this.id = new DocumentIdValueObject(input.id);
    this.title =
      input.title != null
        ? new DocumentTitleValueObject(input.title)
        : undefined;
    this.content =
      input.content != null
        ? new DocumentContentValueObject(input.content)
        : undefined;
  }
}
