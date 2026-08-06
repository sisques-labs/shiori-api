import { Injectable } from '@nestjs/common';
import {
  BaseBuilder,
  DateValueObject,
  FieldIsRequiredException,
} from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseDescriptionValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-description/knowledge-base-description.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

@Injectable()
export class KnowledgeBaseBuilder extends BaseBuilder<
  KnowledgeBaseAggregate,
  KnowledgeBaseViewModel
> {
  private _name!: string;
  private _description: string | null = null;
  private _apiKeyHash!: string;

  withName(name: string): this {
    this._name = name;
    return this;
  }

  withDescription(description: string | null): this {
    this._description = description;
    return this;
  }

  withApiKeyHash(apiKeyHash: string): this {
    this._apiKeyHash = apiKeyHash;
    return this;
  }

  public override build(): KnowledgeBaseAggregate {
    this.validate();
    return new KnowledgeBaseAggregate({
      id: new KnowledgeBaseIdValueObject(this._id),
      name: new KnowledgeBaseNameValueObject(this._name),
      description:
        this._description != null
          ? new KnowledgeBaseDescriptionValueObject(this._description)
          : null,
      apiKeyHash: new KnowledgeBaseApiKeyHashValueObject(this._apiKeyHash),
      createdAt: new DateValueObject(this._createdAt),
      updatedAt: new DateValueObject(this._updatedAt),
    });
  }

  public override buildViewModel(): KnowledgeBaseViewModel {
    this.validate();
    return new KnowledgeBaseViewModel({
      id: this._id,
      name: this._name,
      description: this._description,
      apiKeyHash: this._apiKeyHash,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    });
  }

  public override validate(): void {
    super.validate();
    if (!this._name) throw new FieldIsRequiredException('name');
    if (!this._apiKeyHash) throw new FieldIsRequiredException('apiKeyHash');
  }
}
