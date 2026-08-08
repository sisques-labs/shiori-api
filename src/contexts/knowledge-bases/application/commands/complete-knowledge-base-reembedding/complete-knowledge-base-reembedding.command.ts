import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';

export type CompleteKnowledgeBaseReembeddingCommandInput = Pick<
  IKnowledgeBasePrimitives,
  'id'
>;

/**
 * Internal only — no transport surface. Dispatched exclusively by
 * `embeddings`' `ReembedKnowledgeBaseProcessor` on re-embed success.
 */
export class CompleteKnowledgeBaseReembeddingCommand {
  public readonly id: KnowledgeBaseIdValueObject;

  constructor(input: CompleteKnowledgeBaseReembeddingCommandInput) {
    this.id = new KnowledgeBaseIdValueObject(input.id);
  }
}
