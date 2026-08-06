import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DocumentContentValueObject } from '@contexts/documents/domain/value-objects/document-content/document-content.value-object';
import { DocumentTitleValueObject } from '@contexts/documents/domain/value-objects/document-title/document-title.value-object';

export interface CreateDocumentCommandInput {
  knowledgeBaseId: string;
  title: string;
  content: string;
}

export class CreateDocumentCommand {
  public readonly knowledgeBaseId: UuidValueObject;
  public readonly title: DocumentTitleValueObject;
  public readonly content: DocumentContentValueObject;

  constructor(input: CreateDocumentCommandInput) {
    this.knowledgeBaseId = new UuidValueObject(input.knowledgeBaseId);
    this.title = new DocumentTitleValueObject(input.title);
    this.content = new DocumentContentValueObject(input.content);
  }
}
