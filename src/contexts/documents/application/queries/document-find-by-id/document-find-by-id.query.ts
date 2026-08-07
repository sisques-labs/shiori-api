import { IDocumentPrimitives } from '@contexts/documents/domain/primitives/document.primitives';

export type DocumentFindByIdQueryInput = Pick<IDocumentPrimitives, 'id'>;

export class DocumentFindByIdQuery {
  public readonly id: string;

  constructor(input: DocumentFindByIdQueryInput) {
    this.id = input.id;
  }
}
