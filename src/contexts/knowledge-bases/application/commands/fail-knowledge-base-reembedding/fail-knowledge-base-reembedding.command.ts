import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseReembeddingFailureReasonValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-reembedding-failure-reason/knowledge-base-reembedding-failure-reason.value-object';

export type FailKnowledgeBaseReembeddingCommandInput = Pick<
  IKnowledgeBasePrimitives,
  'id'
> & { reason: string };

/**
 * Internal only — no transport surface. Dispatched exclusively by
 * `embeddings`' `ReembedKnowledgeBaseProcessor` on re-embed failure. A
 * `FAILED` Knowledge Base can be retried by calling
 * `ChangeKnowledgeBaseEmbeddingModel` again.
 */
export class FailKnowledgeBaseReembeddingCommand {
  public readonly id: KnowledgeBaseIdValueObject;
  public readonly reason: KnowledgeBaseReembeddingFailureReasonValueObject;

  constructor(input: FailKnowledgeBaseReembeddingCommandInput) {
    this.id = new KnowledgeBaseIdValueObject(input.id);
    this.reason = new KnowledgeBaseReembeddingFailureReasonValueObject(
      input.reason,
    );
  }
}
