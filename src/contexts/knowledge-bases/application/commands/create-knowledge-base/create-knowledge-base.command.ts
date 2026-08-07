import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';
import { KnowledgeBaseDescriptionValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-description/knowledge-base-description.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

export type CreateKnowledgeBaseCommandInput = Pick<
  IKnowledgeBasePrimitives,
  'name'
> &
  Partial<Pick<IKnowledgeBasePrimitives, 'description'>>;

export class CreateKnowledgeBaseCommand {
  public readonly name: KnowledgeBaseNameValueObject;
  public readonly description?: KnowledgeBaseDescriptionValueObject;

  constructor(input: CreateKnowledgeBaseCommandInput) {
    this.name = new KnowledgeBaseNameValueObject(input.name);
    this.description =
      input.description != null
        ? new KnowledgeBaseDescriptionValueObject(input.description)
        : undefined;
  }
}
