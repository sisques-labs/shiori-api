import { Injectable } from '@nestjs/common';
import {
  BaseBuilder,
  DateValueObject,
  FieldIsRequiredException,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';
import { DocumentChunkCountValueObject } from '@contexts/documents/domain/value-objects/document-chunk-count/document-chunk-count.value-object';
import { DocumentContentValueObject } from '@contexts/documents/domain/value-objects/document-content/document-content.value-object';
import { DocumentFailureReasonValueObject } from '@contexts/documents/domain/value-objects/document-failure-reason/document-failure-reason.value-object';
import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';
import { DocumentStatusValueObject } from '@contexts/documents/domain/value-objects/document-status/document-status.value-object';
import { DocumentTitleValueObject } from '@contexts/documents/domain/value-objects/document-title/document-title.value-object';

@Injectable()
export class DocumentBuilder extends BaseBuilder<
  DocumentAggregate,
  DocumentViewModel
> {
  private _knowledgeBaseId!: string;
  private _title!: string;
  private _content!: string;
  private _status: string = DocumentStatusEnum.PENDING;
  private _failureReason: string | null = null;
  private _chunkCount = 0;

  withKnowledgeBaseId(knowledgeBaseId: string): this {
    this._knowledgeBaseId = knowledgeBaseId;
    return this;
  }

  withTitle(title: string): this {
    this._title = title;
    return this;
  }

  withContent(content: string): this {
    this._content = content;
    return this;
  }

  withStatus(status: string): this {
    this._status = status;
    return this;
  }

  withFailureReason(failureReason: string | null): this {
    this._failureReason = failureReason;
    return this;
  }

  withChunkCount(chunkCount: number): this {
    this._chunkCount = chunkCount;
    return this;
  }

  public override build(): DocumentAggregate {
    this.validate();
    return new DocumentAggregate({
      id: new DocumentIdValueObject(this._id),
      knowledgeBaseId: new UuidValueObject(this._knowledgeBaseId),
      title: new DocumentTitleValueObject(this._title),
      content: new DocumentContentValueObject(this._content),
      status: new DocumentStatusValueObject(this._status as DocumentStatusEnum),
      failureReason:
        this._failureReason != null
          ? new DocumentFailureReasonValueObject(this._failureReason)
          : null,
      chunkCount: new DocumentChunkCountValueObject(this._chunkCount),
      createdAt: new DateValueObject(this._createdAt),
      updatedAt: new DateValueObject(this._updatedAt),
    });
  }

  public override buildViewModel(): DocumentViewModel {
    this.validate();
    return new DocumentViewModel({
      id: this._id,
      knowledgeBaseId: this._knowledgeBaseId,
      title: this._title,
      content: this._content,
      status: this._status,
      failureReason: this._failureReason,
      chunkCount: this._chunkCount,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    });
  }

  public override validate(): void {
    super.validate();
    if (!this._knowledgeBaseId)
      throw new FieldIsRequiredException('knowledgeBaseId');
    if (!this._title) throw new FieldIsRequiredException('title');
    if (!this._content) throw new FieldIsRequiredException('content');
  }
}
