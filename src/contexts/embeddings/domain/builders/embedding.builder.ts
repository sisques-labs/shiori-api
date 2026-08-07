import { Injectable } from '@nestjs/common';
import {
  BaseBuilder,
  DateValueObject,
  FieldIsRequiredException,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { EmbeddingAggregate } from '@contexts/embeddings/domain/aggregates/embedding.aggregate';
import { EmbeddingViewModel } from '@contexts/embeddings/domain/view-models/embedding.view-model';
import { EmbeddingChunkPositionValueObject } from '@contexts/embeddings/domain/value-objects/embedding-chunk-position/embedding-chunk-position.value-object';
import { EmbeddingChunkTextValueObject } from '@contexts/embeddings/domain/value-objects/embedding-chunk-text/embedding-chunk-text.value-object';
import { EmbeddingIdValueObject } from '@contexts/embeddings/domain/value-objects/embedding-id/embedding-id.value-object';
import { EmbeddingModelValueObject } from '@contexts/embeddings/domain/value-objects/embedding-model/embedding-model.value-object';
import { EmbeddingVectorValueObject } from '@contexts/embeddings/domain/value-objects/embedding-vector/embedding-vector.value-object';

/**
 * EmbeddingAggregate has no `updatedAt` (hydration-only, never
 * independently updated), so `validate()` is overridden rather than
 * delegating to `super.validate()` — the base implementation also requires
 * `_updatedAt`. Mirrors `ChunkBuilder` in `documents`.
 */
@Injectable()
export class EmbeddingBuilder extends BaseBuilder<
  EmbeddingAggregate,
  EmbeddingViewModel
> {
  private _knowledgeBaseId!: string;
  private _documentId!: string;
  private _chunkId!: string;
  private _chunkText!: string;
  private _chunkPosition!: number;
  private _embedding!: number[];
  private _model!: string;

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

  public override validate(): void {
    if (!this._id) throw new FieldIsRequiredException('id');
    if (this._createdAt == null) {
      throw new FieldIsRequiredException('createdAt');
    }
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

  public override build(): EmbeddingAggregate {
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

  public override buildViewModel(): EmbeddingViewModel {
    this.validate();
    return new EmbeddingViewModel({
      id: this._id,
      knowledgeBaseId: this._knowledgeBaseId,
      documentId: this._documentId,
      chunkId: this._chunkId,
      chunkText: this._chunkText,
      chunkPosition: this._chunkPosition,
      embedding: this._embedding,
      model: this._model,
      createdAt: this._createdAt,
    });
  }
}
