export interface DocumentFindByIdQueryInput {
  id: string;
}

export class DocumentFindByIdQuery {
  public readonly id: string;

  constructor(input: DocumentFindByIdQueryInput) {
    this.id = input.id;
  }
}
