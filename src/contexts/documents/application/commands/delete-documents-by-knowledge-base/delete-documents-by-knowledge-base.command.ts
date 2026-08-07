export interface DeleteDocumentsByKnowledgeBaseCommandInput {
  knowledgeBaseId: string;
}

export class DeleteDocumentsByKnowledgeBaseCommand {
  public readonly knowledgeBaseId: string;

  constructor(input: DeleteDocumentsByKnowledgeBaseCommandInput) {
    this.knowledgeBaseId = input.knowledgeBaseId;
  }
}
