export interface DeleteEmbeddingsByKnowledgeBaseCommandInput {
  knowledgeBaseId: string;
}

export class DeleteEmbeddingsByKnowledgeBaseCommand {
  public readonly knowledgeBaseId: string;

  constructor(input: DeleteEmbeddingsByKnowledgeBaseCommandInput) {
    this.knowledgeBaseId = input.knowledgeBaseId;
  }
}
