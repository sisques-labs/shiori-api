import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';

export interface RotateKnowledgeBaseApiKeyCommandInput {
  id: string;
}

export class RotateKnowledgeBaseApiKeyCommand {
  public readonly id: KnowledgeBaseIdValueObject;

  constructor(input: RotateKnowledgeBaseApiKeyCommandInput) {
    this.id = new KnowledgeBaseIdValueObject(input.id);
  }
}
