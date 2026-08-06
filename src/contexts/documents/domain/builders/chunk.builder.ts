import { Injectable } from '@nestjs/common';
import {
  DateValueObject,
  FieldIsRequiredException,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { ChunkAggregate } from '@contexts/documents/domain/aggregates/chunk.aggregate';
import { ChunkIdValueObject } from '@contexts/documents/domain/value-objects/chunk-id/chunk-id.value-object';
import { ChunkPositionValueObject } from '@contexts/documents/domain/value-objects/chunk-position/chunk-position.value-object';
import { ChunkTextValueObject } from '@contexts/documents/domain/value-objects/chunk-text/chunk-text.value-object';

@Injectable()
export class ChunkBuilder {
  private _id!: string;
  private _documentId!: string;
  private _knowledgeBaseId!: string;
  private _position!: number;
  private _text!: string;
  private _createdAt: Date = new Date();

  withId(id: string): this {
    this._id = id;
    return this;
  }

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

  withCreatedAt(createdAt: Date): this {
    this._createdAt = createdAt;
    return this;
  }

  private validate(): void {
    if (!this._id) throw new FieldIsRequiredException('id');
    if (!this._documentId) throw new FieldIsRequiredException('documentId');
    if (!this._knowledgeBaseId)
      throw new FieldIsRequiredException('knowledgeBaseId');
    if (this._text == null) throw new FieldIsRequiredException('text');
  }

  build(): ChunkAggregate {
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
}
