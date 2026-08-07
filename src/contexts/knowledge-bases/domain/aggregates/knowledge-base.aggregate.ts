import { BaseAggregate } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseApiKeyRotatedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-api-key-rotated/knowledge-base-api-key-rotated.event';
import { KnowledgeBaseCreatedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-created/knowledge-base-created.event';
import { KnowledgeBaseDeletedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-deleted/knowledge-base-deleted.event';
import { KnowledgeBaseDescriptionChangedEvent } from '@contexts/knowledge-bases/domain/events/field-changed/knowledge-base-description-changed/knowledge-base-description-changed.event';
import { KnowledgeBaseNameChangedEvent } from '@contexts/knowledge-bases/domain/events/field-changed/knowledge-base-name-changed/knowledge-base-name-changed.event';
import { KnowledgeBaseUpdatedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-updated/knowledge-base-updated.event';
import { IKnowledgeBaseEventData } from '@contexts/knowledge-bases/domain/events/interfaces/knowledge-base-event-data.interface';
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

  public update(
    props: Omit<Partial<IKnowledgeBase>, 'id' | 'createdAt' | 'updatedAt'>,
  ): void {
    if (props.name !== undefined) {
      this.changeName(props.name);
    }
    if (props.description !== undefined) {
      this.changeDescription(props.description);
    }

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

  private changeName(newName: KnowledgeBaseNameValueObject): void {
    if (this._name.equals(newName)) return;

    const oldValue = this._name.value;
    this._name = newName;
    this.touch();

    this.apply(
      new KnowledgeBaseNameChangedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: KnowledgeBaseAggregate.name,
          entityId: this._id.value,
          entityType: KnowledgeBaseAggregate.name,
          eventType: KnowledgeBaseNameChangedEvent.name,
        },
        {
          id: this._id.value,
          oldValue,
          newValue: newName.value,
        },
      ),
    );
  }

  private changeDescription(
    newDescription: KnowledgeBaseDescriptionValueObject | null,
  ): void {
    const oldValue = this._description?.value ?? null;
    const newValue = newDescription?.value ?? null;
    if (oldValue === newValue) return;

    this._description = newDescription;
    this.touch();

    this.apply(
      new KnowledgeBaseDescriptionChangedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: KnowledgeBaseAggregate.name,
          entityId: this._id.value,
          entityType: KnowledgeBaseAggregate.name,
          eventType: KnowledgeBaseDescriptionChangedEvent.name,
        },
        {
          id: this._id.value,
          oldValue,
          newValue: newDescription?.value ?? null,
        },
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

  private toEventData(): IKnowledgeBaseEventData {
    return {
      id: this._id.value,
      name: this._name.value,
      description: this._description?.value ?? null,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
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
