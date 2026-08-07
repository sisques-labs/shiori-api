import {
  IKnowledgeBaseBasePrimitives,
  IKnowledgeBasePrimitives,
} from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseDescriptionValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-description/knowledge-base-description.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

export type UpdateKnowledgeBaseCommandInput = Pick<
  IKnowledgeBasePrimitives,
  'id'
> &
  IKnowledgeBaseBasePrimitives;

export class UpdateKnowledgeBaseCommand {
  public readonly id: KnowledgeBaseIdValueObject;
  public readonly name?: KnowledgeBaseNameValueObject;
  public readonly description?: KnowledgeBaseDescriptionValueObject | null;

  constructor(input: UpdateKnowledgeBaseCommandInput) {
    this.id = new KnowledgeBaseIdValueObject(input.id);
    this.name =
      input.name != null
        ? new KnowledgeBaseNameValueObject(input.name)
        : undefined;
    this.description =
      input.description !== undefined
        ? input.description != null
          ? new KnowledgeBaseDescriptionValueObject(input.description)
          : null
        : undefined;
  }
}
