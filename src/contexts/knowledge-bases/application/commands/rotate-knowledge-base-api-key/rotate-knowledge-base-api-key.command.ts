import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';

export type RotateKnowledgeBaseApiKeyCommandInput = Pick<
  IKnowledgeBasePrimitives,
  'id'
>;

export class RotateKnowledgeBaseApiKeyCommand {
  public readonly id: KnowledgeBaseIdValueObject;

  constructor(input: RotateKnowledgeBaseApiKeyCommandInput) {
    this.id = new KnowledgeBaseIdValueObject(input.id);
  }
}
