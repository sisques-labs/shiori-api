export interface ChunkFindByDocumentIdQueryInput {
  documentId: string;
}

export class ChunkFindByDocumentIdQuery {
  public readonly documentId: string;

  constructor(input: ChunkFindByDocumentIdQueryInput) {
    this.documentId = input.documentId;
  }
}
