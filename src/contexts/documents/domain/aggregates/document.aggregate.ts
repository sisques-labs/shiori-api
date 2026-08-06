import { BaseAggregate, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DocumentChunkedEvent } from '@contexts/documents/domain/events/document-chunked/document-chunked.event';
import { DocumentChunkingFailedEvent } from '@contexts/documents/domain/events/document-chunking-failed/document-chunking-failed.event';
import { DocumentChunkingStartedEvent } from '@contexts/documents/domain/events/document-chunking-started/document-chunking-started.event';
import { DocumentCreatedEvent } from '@contexts/documents/domain/events/document-created/document-created.event';
import { DocumentDeletedEvent } from '@contexts/documents/domain/events/document-deleted/document-deleted.event';
import { DocumentUpdatedEvent } from '@contexts/documents/domain/events/document-updated/document-updated.event';
import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentInvalidStatusTransitionException } from '@contexts/documents/domain/exceptions/document-invalid-status-transition.exception';
import { IDocument } from '@contexts/documents/domain/interfaces/document.interface';
import { IDocumentPrimitives } from '@contexts/documents/domain/primitives/document.primitives';
import { DocumentContentValueObject } from '@contexts/documents/domain/value-objects/document-content/document-content.value-object';
import { DocumentFailureReasonValueObject } from '@contexts/documents/domain/value-objects/document-failure-reason/document-failure-reason.value-object';
import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';
import { DocumentStatusValueObject } from '@contexts/documents/domain/value-objects/document-status/document-status.value-object';
import { DocumentTitleValueObject } from '@contexts/documents/domain/value-objects/document-title/document-title.value-object';

export class DocumentAggregate extends BaseAggregate {
  private readonly _id: DocumentIdValueObject;
  private readonly _knowledgeBaseId: UuidValueObject;
  private _title: DocumentTitleValueObject;
  private _content: DocumentContentValueObject;
  private _status: DocumentStatusValueObject;
  private _failureReason: DocumentFailureReasonValueObject | null;
  private _chunkCount: number;

  constructor(props: IDocument & { chunkCount: number }) {
    super(props.createdAt, props.updatedAt);
    this._id = props.id;
    this._knowledgeBaseId = props.knowledgeBaseId;
    this._title = props.title;
    this._content = props.content;
    this._status = props.status;
    this._failureReason = props.failureReason;
    this._chunkCount = props.chunkCount;
  }

  public create(): void {
    this.apply(
      new DocumentCreatedEvent(
        this.metadata(DocumentCreatedEvent.name),
        this.toEventData(),
      ),
    );
  }

  public update(props: {
    title?: DocumentTitleValueObject;
    content?: DocumentContentValueObject;
  }): void {
    if (this._status.value === DocumentStatusEnum.CHUNKING) {
      throw new DocumentInvalidStatusTransitionException(
        this._status.value,
        'updated-while-chunking',
      );
    }

    if (props.title !== undefined) this._title = props.title;
    if (props.content !== undefined) {
      this._content = props.content;
      // Content changed — the existing chunks (if any) are stale. Caller
      // (the command handler) is responsible for deleting them and
      // re-enqueuing; this aggregate only reflects the resulting state.
      this._status = new DocumentStatusValueObject(DocumentStatusEnum.PENDING);
      this._chunkCount = 0;
      this._failureReason = null;
    }
    this.touch();

    this.apply(
      new DocumentUpdatedEvent(
        this.metadata(DocumentUpdatedEvent.name),
        this.toEventData(),
      ),
    );
  }

  public delete(): void {
    this.apply(
      new DocumentDeletedEvent(
        this.metadata(DocumentDeletedEvent.name),
        this.toEventData(),
      ),
    );
  }

  public startChunking(): void {
    this.assertTransition(
      DocumentStatusEnum.PENDING,
      DocumentStatusEnum.CHUNKING,
    );
    this._status = new DocumentStatusValueObject(DocumentStatusEnum.CHUNKING);
    this.touch();

    this.apply(
      new DocumentChunkingStartedEvent(
        this.metadata(DocumentChunkingStartedEvent.name),
        this.toEventData(),
      ),
    );
  }

  public completeChunking(chunkCount: number): void {
    this.assertTransition(
      DocumentStatusEnum.CHUNKING,
      DocumentStatusEnum.CHUNKED,
    );
    this._status = new DocumentStatusValueObject(DocumentStatusEnum.CHUNKED);
    this._chunkCount = chunkCount;
    this._failureReason = null;
    this.touch();

    this.apply(
      new DocumentChunkedEvent(
        this.metadata(DocumentChunkedEvent.name),
        this.toEventData(),
      ),
    );
  }

  public failChunking(reason: string): void {
    this.assertTransition(
      DocumentStatusEnum.CHUNKING,
      DocumentStatusEnum.FAILED,
    );
    this._status = new DocumentStatusValueObject(DocumentStatusEnum.FAILED);
    this._failureReason = new DocumentFailureReasonValueObject(reason);
    this.touch();

    this.apply(
      new DocumentChunkingFailedEvent(
        this.metadata(DocumentChunkingFailedEvent.name),
        this.toEventData(),
      ),
    );
  }

  private assertTransition(
    expectedFrom: DocumentStatusEnum,
    to: DocumentStatusEnum,
  ): void {
    if (this._status.value !== expectedFrom) {
      throw new DocumentInvalidStatusTransitionException(
        this._status.value,
        to,
      );
    }
  }

  private metadata(eventType: string) {
    return {
      aggregateRootId: this._id.value,
      aggregateRootType: DocumentAggregate.name,
      entityId: this._id.value,
      entityType: DocumentAggregate.name,
      eventType,
    };
  }

  private toEventData() {
    return {
      id: this._id.value,
      knowledgeBaseId: this._knowledgeBaseId.value,
      status: this._status.value,
    };
  }

  public toPrimitives(): IDocumentPrimitives {
    return {
      id: this._id.value,
      knowledgeBaseId: this._knowledgeBaseId.value,
      title: this._title.value,
      content: this._content.value,
      status: this._status.value,
      failureReason: this._failureReason?.value ?? null,
      chunkCount: this._chunkCount,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
    };
  }

  get id(): DocumentIdValueObject {
    return this._id;
  }

  get knowledgeBaseId(): UuidValueObject {
    return this._knowledgeBaseId;
  }

  get title(): DocumentTitleValueObject {
    return this._title;
  }

  get content(): DocumentContentValueObject {
    return this._content;
  }

  get status(): DocumentStatusValueObject {
    return this._status;
  }

  get failureReason(): DocumentFailureReasonValueObject | null {
    return this._failureReason;
  }

  get chunkCount(): number {
    return this._chunkCount;
  }
}
