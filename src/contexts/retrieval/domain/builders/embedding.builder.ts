import { Injectable } from '@nestjs/common';
import {
  DateValueObject,
  FieldIsRequiredException,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { EmbeddingAggregate } from '@contexts/retrieval/domain/aggregates/embedding.aggregate';
import { EmbeddingChunkPositionValueObject } from '@contexts/retrieval/domain/value-objects/embedding-chunk-position/embedding-chunk-position.value-object';
import { EmbeddingChunkTextValueObject } from '@contexts/retrieval/domain/value-objects/embedding-chunk-text/embedding-chunk-text.value-object';
import { EmbeddingIdValueObject } from '@contexts/retrieval/domain/value-objects/embedding-id/embedding-id.value-object';
import { EmbeddingModelValueObject } from '@contexts/retrieval/domain/value-objects/embedding-model/embedding-model.value-object';
import { EmbeddingVectorValueObject } from '@contexts/retrieval/domain/value-objects/embedding-vector/embedding-vector.value-object';

@Injectable()
export class EmbeddingBuilder {
  private _id!: string;
  private _knowledgeBaseId!: string;
  private _documentId!: string;
  private _chunkId!: string;
  private _chunkText!: string;
  private _chunkPosition!: number;
  private _embedding!: number[];
  private _model!: string;
  private _createdAt: Date = new Date();

  withId(id: string): this {
    this._id = id;
    return this;
  }

  withKnowledgeBaseId(knowledgeBaseId: string): this {
    this._knowledgeBaseId = knowledgeBaseId;
    return this;
  }

  withDocumentId(documentId: string): this {
    this._documentId = documentId;
    return this;
  }

  withChunkId(chunkId: string): this {
    this._chunkId = chunkId;
    return this;
  }

  withChunkText(chunkText: string): this {
    this._chunkText = chunkText;
    return this;
  }

  withChunkPosition(chunkPosition: number): this {
    this._chunkPosition = chunkPosition;
    return this;
  }

  withEmbedding(embedding: number[]): this {
    this._embedding = embedding;
    return this;
  }

  withModel(model: string): this {
    this._model = model;
    return this;
  }

  withCreatedAt(createdAt: Date): this {
    this._createdAt = createdAt;
    return this;
  }

  private validate(): void {
    if (!this._id) throw new FieldIsRequiredException('id');
    if (!this._knowledgeBaseId)
      throw new FieldIsRequiredException('knowledgeBaseId');
    if (!this._documentId) throw new FieldIsRequiredException('documentId');
    if (!this._chunkId) throw new FieldIsRequiredException('chunkId');
    if (this._chunkText == null)
      throw new FieldIsRequiredException('chunkText');
    if (this._embedding == null)
      throw new FieldIsRequiredException('embedding');
    if (!this._model) throw new FieldIsRequiredException('model');
  }

  build(): EmbeddingAggregate {
    this.validate();
    return new EmbeddingAggregate({
      id: new EmbeddingIdValueObject(this._id),
      knowledgeBaseId: new UuidValueObject(this._knowledgeBaseId),
      documentId: new UuidValueObject(this._documentId),
      chunkId: new UuidValueObject(this._chunkId),
      chunkText: new EmbeddingChunkTextValueObject(this._chunkText),
      chunkPosition: new EmbeddingChunkPositionValueObject(this._chunkPosition),
      embedding: new EmbeddingVectorValueObject(this._embedding),
      model: new EmbeddingModelValueObject(this._model),
      createdAt: new DateValueObject(this._createdAt),
    });
  }
}
