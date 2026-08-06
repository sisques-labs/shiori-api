import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';

export interface DeleteKnowledgeBaseCommandInput {
  id: string;
}

export class DeleteKnowledgeBaseCommand {
  public readonly id: KnowledgeBaseIdValueObject;

  constructor(input: DeleteKnowledgeBaseCommandInput) {
    this.id = new KnowledgeBaseIdValueObject(input.id);
  }
}
