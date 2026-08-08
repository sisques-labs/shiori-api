import { IDocumentPrimitives } from '@contexts/documents/domain/primitives/document.primitives';
import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';

export type RechunkDocumentCommandInput = Pick<IDocumentPrimitives, 'id'>;

export class RechunkDocumentCommand {
  public readonly id: DocumentIdValueObject;

  constructor(input: RechunkDocumentCommandInput) {
    this.id = new DocumentIdValueObject(input.id);
  }
}
