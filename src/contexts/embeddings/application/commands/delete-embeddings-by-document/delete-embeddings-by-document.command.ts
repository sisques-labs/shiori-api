export interface DeleteEmbeddingsByDocumentCommandInput {
  documentId: string;
}

export class DeleteEmbeddingsByDocumentCommand {
  public readonly documentId: string;

  constructor(input: DeleteEmbeddingsByDocumentCommandInput) {
    this.documentId = input.documentId;
  }
}
