import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';

export type ReembedKnowledgeBaseCommandInput = Pick<
  IKnowledgeBasePrimitives,
  'id'
>;

export class ReembedKnowledgeBaseCommand {
  public readonly id: KnowledgeBaseIdValueObject;

  constructor(input: ReembedKnowledgeBaseCommandInput) {
    this.id = new KnowledgeBaseIdValueObject(input.id);
  }
}
