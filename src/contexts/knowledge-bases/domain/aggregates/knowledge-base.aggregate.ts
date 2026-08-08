import { BaseAggregate } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseApiKeyRotatedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-api-key-rotated/knowledge-base-api-key-rotated.event';
import { KnowledgeBaseCreatedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-created/knowledge-base-created.event';
import { KnowledgeBaseDeletedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-deleted/knowledge-base-deleted.event';
import { KnowledgeBaseDescriptionChangedEvent } from '@contexts/knowledge-bases/domain/events/field-changed/knowledge-base-description-changed/knowledge-base-description-changed.event';
import { KnowledgeBaseNameChangedEvent } from '@contexts/knowledge-bases/domain/events/field-changed/knowledge-base-name-changed/knowledge-base-name-changed.event';
import { KnowledgeBaseUpdatedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-updated/knowledge-base-updated.event';
import { IKnowledgeBase } from '@contexts/knowledge-bases/domain/interfaces/knowledge-base.interface';
import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';
import { KnowledgeBaseEmbeddingModelChangeRequestedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-embedding-model-change-requested/knowledge-base-embedding-model-change-requested.event';
import { KnowledgeBaseEmbeddingStatusEnum } from '@contexts/knowledge-bases/domain/enums/knowledge-base-embedding-status.enum';
import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseDescriptionValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-description/knowledge-base-description.value-object';
import { KnowledgeBaseEmbeddingModelValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-model/knowledge-base-embedding-model.value-object';
import { KnowledgeBaseEmbeddingStatusValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-embedding-status/knowledge-base-embedding-status.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

export class KnowledgeBaseAggregate extends BaseAggregate {
  private readonly _id: KnowledgeBaseIdValueObject;
  private _name: KnowledgeBaseNameValueObject;
  private _description: KnowledgeBaseDescriptionValueObject | null;
  private _apiKeyHash: KnowledgeBaseApiKeyHashValueObject;
  private _embeddingModel: KnowledgeBaseEmbeddingModelValueObject;
  private _embeddingStatus: KnowledgeBaseEmbeddingStatusValueObject;

  constructor(props: IKnowledgeBase) {
    super(props.createdAt, props.updatedAt);
    this._id = props.id;
    this._name = props.name;
    this._description = props.description;
    this._apiKeyHash = props.apiKeyHash;
    this._embeddingModel = props.embeddingModel;
    this._embeddingStatus = props.embeddingStatus;
  }

  public create(): void {
    const { apiKeyHash: _apiKeyHash, ...eventData } = this.toPrimitives();

    this.apply(
      new KnowledgeBaseCreatedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: KnowledgeBaseAggregate.name,
          entityId: this._id.value,
          entityType: KnowledgeBaseAggregate.name,
          eventType: KnowledgeBaseCreatedEvent.name,
        },
        eventData,
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

    const { apiKeyHash: _apiKeyHash, ...eventData } = this.toPrimitives();

    this.apply(
      new KnowledgeBaseUpdatedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: KnowledgeBaseAggregate.name,
          entityId: this._id.value,
          entityType: KnowledgeBaseAggregate.name,
          eventType: KnowledgeBaseUpdatedEvent.name,
        },
        eventData,
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
    const { apiKeyHash: _apiKeyHash, ...eventData } = this.toPrimitives();

    this.apply(
      new KnowledgeBaseDeletedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: KnowledgeBaseAggregate.name,
          entityId: this._id.value,
          entityType: KnowledgeBaseAggregate.name,
          eventType: KnowledgeBaseDeletedEvent.name,
        },
        eventData,
      ),
    );
  }

  public rotateApiKey(newHash: KnowledgeBaseApiKeyHashValueObject): void {
    this._apiKeyHash = newHash;
    this.touch();

    const { apiKeyHash: _apiKeyHash, ...eventData } = this.toPrimitives();

    this.apply(
      new KnowledgeBaseApiKeyRotatedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: KnowledgeBaseAggregate.name,
          entityId: this._id.value,
          entityType: KnowledgeBaseAggregate.name,
          eventType: KnowledgeBaseApiKeyRotatedEvent.name,
        },
        eventData,
      ),
    );
  }

  /**
   * No-ops (no event, no state change) if `newModel` equals the current
   * `embeddingModel`. Otherwise flips the model pointer immediately and
   * moves the Knowledge Base into `REEMBEDDING` — nothing reads
   * `embeddingModel` for search purposes while `embeddingStatus !== READY`,
   * so there is no window where a stale pointer could route a search
   * incorrectly (see design.md).
   */
  public changeEmbeddingModel(
    newModel: KnowledgeBaseEmbeddingModelValueObject,
  ): void {
    if (this._embeddingModel.equals(newModel)) return;

    const previousModel = this._embeddingModel.value;
    this._embeddingModel = newModel;
    this._embeddingStatus = new KnowledgeBaseEmbeddingStatusValueObject(
      KnowledgeBaseEmbeddingStatusEnum.REEMBEDDING,
    );
    this.touch();

    this.apply(
      new KnowledgeBaseEmbeddingModelChangeRequestedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: KnowledgeBaseAggregate.name,
          entityId: this._id.value,
          entityType: KnowledgeBaseAggregate.name,
          eventType: KnowledgeBaseEmbeddingModelChangeRequestedEvent.name,
        },
        {
          knowledgeBaseId: this._id.value,
          previousModel,
          newModel: newModel.value,
        },
      ),
    );
  }

  /**
   * Internal-only mutator — only ever invoked by
   * `CompleteKnowledgeBaseReembeddingCommandHandler`, dispatched by
   * `embeddings`' re-embed processor on success. No public command wraps
   * it directly.
   */
  public completeReembedding(): void {
    this._embeddingStatus = new KnowledgeBaseEmbeddingStatusValueObject(
      KnowledgeBaseEmbeddingStatusEnum.READY,
    );
    this.touch();
  }

  /**
   * Internal-only mutator — only ever invoked by
   * `FailKnowledgeBaseReembeddingCommandHandler`, dispatched by
   * `embeddings`' re-embed processor on failure. `reason` is accepted for
   * parity with the command/spec shape and future logging/observability,
   * but is not currently persisted on the aggregate itself.
   */
  public failReembedding(_reason: string): void {
    this._embeddingStatus = new KnowledgeBaseEmbeddingStatusValueObject(
      KnowledgeBaseEmbeddingStatusEnum.FAILED,
    );
    this.touch();
  }

  public toPrimitives(): IKnowledgeBasePrimitives {
    return {
      id: this._id.value,
      name: this._name.value,
      description: this._description?.value ?? null,
      apiKeyHash: this._apiKeyHash.value,
      embeddingModel: this._embeddingModel.value,
      embeddingStatus: this._embeddingStatus.value,
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

  get embeddingModel(): KnowledgeBaseEmbeddingModelValueObject {
    return this._embeddingModel;
  }

  get embeddingStatus(): KnowledgeBaseEmbeddingStatusValueObject {
    return this._embeddingStatus;
  }
}
