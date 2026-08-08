import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';
import { KnowledgeBaseDescriptionValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-description/knowledge-base-description.value-object';
import { KnowledgeBaseEmbeddingModelValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-model/knowledge-base-embedding-model.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

export type CreateKnowledgeBaseCommandInput = Pick<
  IKnowledgeBasePrimitives,
  'name' | 'embeddingModel'
> &
  Partial<Pick<IKnowledgeBasePrimitives, 'description'>>;

export class CreateKnowledgeBaseCommand {
  public readonly name: KnowledgeBaseNameValueObject;
  public readonly description?: KnowledgeBaseDescriptionValueObject;
  public readonly embeddingModel: KnowledgeBaseEmbeddingModelValueObject;

  constructor(input: CreateKnowledgeBaseCommandInput) {
    this.name = new KnowledgeBaseNameValueObject(input.name);
    this.description =
      input.description != null
        ? new KnowledgeBaseDescriptionValueObject(input.description)
        : undefined;
    this.embeddingModel = new KnowledgeBaseEmbeddingModelValueObject(
      input.embeddingModel,
    );
  }
}
