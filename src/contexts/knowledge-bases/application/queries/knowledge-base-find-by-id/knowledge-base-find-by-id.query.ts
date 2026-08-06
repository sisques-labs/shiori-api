export interface KnowledgeBaseFindByIdQueryInput {
  id: string;
}

export class KnowledgeBaseFindByIdQuery {
  public readonly id: string;

  constructor(input: KnowledgeBaseFindByIdQueryInput) {
    this.id = input.id;
  }
}
