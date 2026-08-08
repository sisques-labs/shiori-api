import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';
import { KnowledgeBaseEmbeddingModelValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-model/knowledge-base-embedding-model.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';

export type ChangeKnowledgeBaseEmbeddingModelCommandInput = Pick<
  IKnowledgeBasePrimitives,
  'id' | 'embeddingModel'
>;

export class ChangeKnowledgeBaseEmbeddingModelCommand {
  public readonly id: KnowledgeBaseIdValueObject;
  public readonly embeddingModel: KnowledgeBaseEmbeddingModelValueObject;

  constructor(input: ChangeKnowledgeBaseEmbeddingModelCommandInput) {
    this.id = new KnowledgeBaseIdValueObject(input.id);
    this.embeddingModel = new KnowledgeBaseEmbeddingModelValueObject(
      input.embeddingModel,
    );
  }
}
