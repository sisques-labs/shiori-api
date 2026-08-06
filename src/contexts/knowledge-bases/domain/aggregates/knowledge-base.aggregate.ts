import { BaseAggregate } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseApiKeyRotatedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-api-key-rotated/knowledge-base-api-key-rotated.event';
import { KnowledgeBaseCreatedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-created/knowledge-base-created.event';
import { KnowledgeBaseDeletedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-deleted/knowledge-base-deleted.event';
import { KnowledgeBaseUpdatedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-updated/knowledge-base-updated.event';
import { IKnowledgeBase } from '@contexts/knowledge-bases/domain/interfaces/knowledge-base.interface';
import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';
import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseDescriptionValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-description/knowledge-base-description.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

export class KnowledgeBaseAggregate extends BaseAggregate {
  private readonly _id: KnowledgeBaseIdValueObject;
  private _name: KnowledgeBaseNameValueObject;
  private _description: KnowledgeBaseDescriptionValueObject | null;
  private _apiKeyHash: KnowledgeBaseApiKeyHashValueObject;

  constructor(props: IKnowledgeBase) {
    super(props.createdAt, props.updatedAt);
    this._id = props.id;
    this._name = props.name;
    this._description = props.description;
    this._apiKeyHash = props.apiKeyHash;
  }

  public create(): void {
    this.apply(
      new KnowledgeBaseCreatedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: KnowledgeBaseAggregate.name,
          entityId: this._id.value,
          entityType: KnowledgeBaseAggregate.name,
          eventType: KnowledgeBaseCreatedEvent.name,
        },
        this.toEventData(),
      ),
    );
  }

  public update(props: {
    name?: KnowledgeBaseNameValueObject;
    description?: KnowledgeBaseDescriptionValueObject | null;
  }): void {
    if (props.name !== undefined) {
      this._name = props.name;
    }
    if (props.description !== undefined) {
      this._description = props.description;
    }
    this.touch();

    this.apply(
      new KnowledgeBaseUpdatedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: KnowledgeBaseAggregate.name,
          entityId: this._id.value,
          entityType: KnowledgeBaseAggregate.name,
          eventType: KnowledgeBaseUpdatedEvent.name,
        },
        this.toEventData(),
      ),
    );
  }

  public delete(): void {
    this.apply(
      new KnowledgeBaseDeletedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: KnowledgeBaseAggregate.name,
          entityId: this._id.value,
          entityType: KnowledgeBaseAggregate.name,
          eventType: KnowledgeBaseDeletedEvent.name,
        },
        this.toEventData(),
      ),
    );
  }

  public rotateApiKey(newHash: KnowledgeBaseApiKeyHashValueObject): void {
    this._apiKeyHash = newHash;
    this.touch();

    this.apply(
      new KnowledgeBaseApiKeyRotatedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: KnowledgeBaseAggregate.name,
          entityId: this._id.value,
          entityType: KnowledgeBaseAggregate.name,
          eventType: KnowledgeBaseApiKeyRotatedEvent.name,
        },
        this.toEventData(),
      ),
    );
  }

  private toEventData() {
    return {
      id: this._id.value,
      name: this._name.value,
    };
  }

  public toPrimitives(): IKnowledgeBasePrimitives {
    return {
      id: this._id.value,
      name: this._name.value,
      description: this._description?.value ?? null,
      apiKeyHash: this._apiKeyHash.value,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
    };
  }

  get id(): KnowledgeBaseIdValueObject {
    return this._id;
  }

  get name(): KnowledgeBaseNameValueObject {
    return this._name;
  }

  get description(): KnowledgeBaseDescriptionValueObject | null {
    return this._description;
  }

  get apiKeyHash(): KnowledgeBaseApiKeyHashValueObject {
    return this._apiKeyHash;
  }
}
