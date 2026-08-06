import { IChunk } from '@contexts/documents/domain/interfaces/chunk.interface';
import { IChunkPrimitives } from '@contexts/documents/domain/primitives/chunk.primitives';
import { ChunkIdValueObject } from '@contexts/documents/domain/value-objects/chunk-id/chunk-id.value-object';
import { ChunkPositionValueObject } from '@contexts/documents/domain/value-objects/chunk-position/chunk-position.value-object';
import { ChunkTextValueObject } from '@contexts/documents/domain/value-objects/chunk-text/chunk-text.value-object';
import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

/**
 * Hydration-only, no domain events — chunks are derived data with exactly
 * one producer (ChunkDocumentProcessor), never independently created,
 * updated, or deleted from a transport entry point.
 */
export class ChunkAggregate {
  private readonly _id: ChunkIdValueObject;
  private readonly _documentId: UuidValueObject;
  private readonly _knowledgeBaseId: UuidValueObject;
  private readonly _position: ChunkPositionValueObject;
  private readonly _text: ChunkTextValueObject;
  private readonly _createdAt: DateValueObject;

  constructor(props: IChunk) {
    this._id = props.id;
    this._documentId = props.documentId;
    this._knowledgeBaseId = props.knowledgeBaseId;
    this._position = props.position;
    this._text = props.text;
    this._createdAt = props.createdAt;
  }

  public toPrimitives(): IChunkPrimitives {
    return {
      id: this._id.value,
      documentId: this._documentId.value,
      knowledgeBaseId: this._knowledgeBaseId.value,
      position: this._position.value,
      text: this._text.value,
      createdAt: this._createdAt.value,
    };
  }

  get id(): ChunkIdValueObject {
    return this._id;
  }

  get documentId(): UuidValueObject {
    return this._documentId;
  }

  get knowledgeBaseId(): UuidValueObject {
    return this._knowledgeBaseId;
  }

  get position(): ChunkPositionValueObject {
    return this._position;
  }

  get text(): ChunkTextValueObject {
    return this._text;
  }

  get createdAt(): DateValueObject {
    return this._createdAt;
  }
}
