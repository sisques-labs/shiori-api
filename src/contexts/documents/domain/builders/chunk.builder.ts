import { Injectable } from '@nestjs/common';
import {
  BaseBuilder,
  DateValueObject,
  FieldIsRequiredException,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { ChunkAggregate } from '@contexts/documents/domain/aggregates/chunk.aggregate';
import { ChunkViewModel } from '@contexts/documents/domain/view-models/chunk.view-model';
import { ChunkIdValueObject } from '@contexts/documents/domain/value-objects/chunk-id/chunk-id.value-object';
import { ChunkPositionValueObject } from '@contexts/documents/domain/value-objects/chunk-position/chunk-position.value-object';
import { ChunkTextValueObject } from '@contexts/documents/domain/value-objects/chunk-text/chunk-text.value-object';

/**
 * ChunkAggregate has no `updatedAt` (hydration-only, never independently
 * updated), so `validate()` is overridden rather than delegating to
 * `super.validate()` — the base implementation also requires `_updatedAt`.
 */
@Injectable()
export class ChunkBuilder extends BaseBuilder<ChunkAggregate, ChunkViewModel> {
  private _documentId!: string;
  private _knowledgeBaseId!: string;
  private _position!: number;
  private _text!: string;

  withDocumentId(documentId: string): this {
    this._documentId = documentId;
    return this;
  }

  withKnowledgeBaseId(knowledgeBaseId: string): this {
    this._knowledgeBaseId = knowledgeBaseId;
    return this;
  }

  withPosition(position: number): this {
    this._position = position;
    return this;
  }

  withText(text: string): this {
    this._text = text;
    return this;
  }

  public override validate(): void {
    if (!this._id) throw new FieldIsRequiredException('id');
    if (this._createdAt == null) {
      throw new FieldIsRequiredException('createdAt');
    }
    if (!this._documentId) throw new FieldIsRequiredException('documentId');
    if (!this._knowledgeBaseId)
      throw new FieldIsRequiredException('knowledgeBaseId');
    if (this._text == null) throw new FieldIsRequiredException('text');
  }

  public override build(): ChunkAggregate {
    this.validate();
    return new ChunkAggregate({
      id: new ChunkIdValueObject(this._id),
      documentId: new UuidValueObject(this._documentId),
      knowledgeBaseId: new UuidValueObject(this._knowledgeBaseId),
      position: new ChunkPositionValueObject(this._position),
      text: new ChunkTextValueObject(this._text),
      createdAt: new DateValueObject(this._createdAt),
    });
  }

  public override buildViewModel(): ChunkViewModel {
    this.validate();
    return new ChunkViewModel({
      id: this._id,
      documentId: this._documentId,
      knowledgeBaseId: this._knowledgeBaseId,
      position: this._position,
      text: this._text,
      createdAt: this._createdAt,
    });
  }
}
