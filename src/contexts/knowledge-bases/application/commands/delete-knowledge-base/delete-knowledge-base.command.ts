import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';

export type DeleteKnowledgeBaseCommandInput = Pick<
  IKnowledgeBasePrimitives,
  'id'
>;

export class DeleteKnowledgeBaseCommand {
  public readonly id: KnowledgeBaseIdValueObject;

  constructor(input: DeleteKnowledgeBaseCommandInput) {
    this.id = new KnowledgeBaseIdValueObject(input.id);
  }
}
