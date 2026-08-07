import { BaseAggregate, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { IEmbedding } from '@contexts/embeddings/domain/interfaces/embedding.interface';
import { IEmbeddingPrimitives } from '@contexts/embeddings/domain/primitives/embedding.primitives';
import { EmbeddingChunkPositionValueObject } from '@contexts/embeddings/domain/value-objects/embedding-chunk-position/embedding-chunk-position.value-object';
import { EmbeddingChunkTextValueObject } from '@contexts/embeddings/domain/value-objects/embedding-chunk-text/embedding-chunk-text.value-object';
import { EmbeddingIdValueObject } from '@contexts/embeddings/domain/value-objects/embedding-id/embedding-id.value-object';
import { EmbeddingModelValueObject } from '@contexts/embeddings/domain/value-objects/embedding-model/embedding-model.value-object';
import { EmbeddingVectorValueObject } from '@contexts/embeddings/domain/value-objects/embedding-vector/embedding-vector.value-object';

/**
 * No domain events — derived data with a single producer
 * (`EmbedDocumentChunksProcessor`), never independently created, updated,
 * or deleted from a transport entry point. Extends `BaseAggregate` for
 * consistency with the rest of the codebase; `updatedAt` is set once at
 * creation time and never touched again.
 */
export class EmbeddingAggregate extends BaseAggregate {
  private readonly _id: EmbeddingIdValueObject;
  private readonly _knowledgeBaseId: UuidValueObject;
  private readonly _documentId: UuidValueObject;
  private readonly _chunkId: UuidValueObject;
  private readonly _chunkText: EmbeddingChunkTextValueObject;
  private readonly _chunkPosition: EmbeddingChunkPositionValueObject;
  private readonly _embedding: EmbeddingVectorValueObject;
  private readonly _model: EmbeddingModelValueObject;

  constructor(props: IEmbedding) {
    super(props.createdAt, props.updatedAt);
    this._id = props.id;
    this._knowledgeBaseId = props.knowledgeBaseId;
    this._documentId = props.documentId;
    this._chunkId = props.chunkId;
    this._chunkText = props.chunkText;
    this._chunkPosition = props.chunkPosition;
    this._embedding = props.embedding;
    this._model = props.model;
  }

  public toPrimitives(): IEmbeddingPrimitives {
    return {
      id: this._id.value,
      knowledgeBaseId: this._knowledgeBaseId.value,
      documentId: this._documentId.value,
      chunkId: this._chunkId.value,
      chunkText: this._chunkText.value,
      chunkPosition: this._chunkPosition.value,
      embedding: this._embedding.value,
      model: this._model.value,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
    };
  }

  get id(): EmbeddingIdValueObject {
    return this._id;
  }

  get knowledgeBaseId(): UuidValueObject {
    return this._knowledgeBaseId;
  }

  get documentId(): UuidValueObject {
    return this._documentId;
  }

  get chunkId(): UuidValueObject {
    return this._chunkId;
  }

  get chunkText(): EmbeddingChunkTextValueObject {
    return this._chunkText;
  }

  get chunkPosition(): EmbeddingChunkPositionValueObject {
    return this._chunkPosition;
  }

  get embedding(): EmbeddingVectorValueObject {
    return this._embedding;
  }

  get model(): EmbeddingModelValueObject {
    return this._model;
  }
}
