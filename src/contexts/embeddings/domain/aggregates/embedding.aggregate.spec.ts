import {
  DateValueObject,
  InvalidVectorException,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { EmbeddingChunkPositionValueObject } from '@contexts/embeddings/domain/value-objects/embedding-chunk-position/embedding-chunk-position.value-object';
import { EmbeddingChunkTextValueObject } from '@contexts/embeddings/domain/value-objects/embedding-chunk-text/embedding-chunk-text.value-object';
import { EmbeddingIdValueObject } from '@contexts/embeddings/domain/value-objects/embedding-id/embedding-id.value-object';
import { EmbeddingModelValueObject } from '@contexts/embeddings/domain/value-objects/embedding-model/embedding-model.value-object';
import { EmbeddingVectorValueObject } from '@contexts/embeddings/domain/value-objects/embedding-vector/embedding-vector.value-object';
import { EmbeddingBuilder } from '@contexts/embeddings/domain/builders/embedding.builder';

import { EmbeddingAggregate } from './embedding.aggregate';

const TEST_DIMENSIONS = 1536;

function vector(fill = 0.1): number[] {
  return new Array(TEST_DIMENSIONS).fill(fill);
}

describe('EmbeddingAggregate', () => {
  it('hydrates from its constructor props', () => {
    const now = new Date();
    const knowledgeBaseId = UuidValueObject.generate();
    const documentId = UuidValueObject.generate();
    const chunkId = UuidValueObject.generate();

    const embedding = new EmbeddingAggregate({
      id: EmbeddingIdValueObject.generate() as EmbeddingIdValueObject,
      knowledgeBaseId,
      documentId,
      chunkId,
      chunkText: new EmbeddingChunkTextValueObject('some chunk text'),
      chunkPosition: new EmbeddingChunkPositionValueObject(3),
      embedding: new EmbeddingVectorValueObject(vector(), TEST_DIMENSIONS),
      model: new EmbeddingModelValueObject('text-embedding-3-small'),
      createdAt: new DateValueObject(now),
      updatedAt: new DateValueObject(now),
    });

    expect(embedding.knowledgeBaseId.value).toBe(knowledgeBaseId.value);
    expect(embedding.documentId.value).toBe(documentId.value);
    expect(embedding.chunkId.value).toBe(chunkId.value);
    expect(embedding.chunkText.value).toBe('some chunk text');
    expect(embedding.chunkPosition.value).toBe(3);
    expect(embedding.embedding.value).toHaveLength(TEST_DIMENSIONS);
    expect(embedding.model.value).toBe('text-embedding-3-small');
  });

  it('toPrimitives() returns the flat shape', () => {
    const now = new Date();
    const id = EmbeddingIdValueObject.generate() as EmbeddingIdValueObject;
    const knowledgeBaseId = UuidValueObject.generate();
    const documentId = UuidValueObject.generate();
    const chunkId = UuidValueObject.generate();
    const v = vector(0.2);

    const embedding = new EmbeddingAggregate({
      id,
      knowledgeBaseId,
      documentId,
      chunkId,
      chunkText: new EmbeddingChunkTextValueObject('text'),
      chunkPosition: new EmbeddingChunkPositionValueObject(0),
      embedding: new EmbeddingVectorValueObject(v, TEST_DIMENSIONS),
      model: new EmbeddingModelValueObject('m'),
      createdAt: new DateValueObject(now),
      updatedAt: new DateValueObject(now),
    });

    expect(embedding.toPrimitives()).toEqual({
      id: id.value,
      knowledgeBaseId: knowledgeBaseId.value,
      documentId: documentId.value,
      chunkId: chunkId.value,
      chunkText: 'text',
      chunkPosition: 0,
      embedding: v,
      model: 'm',
      createdAt: now,
      updatedAt: now,
    });
  });
});

describe('EmbeddingBuilder — embedding vector dimension', () => {
  function buildWithVector(
    embedding: number[],
    dimensions = TEST_DIMENSIONS,
  ): EmbeddingAggregate {
    return new EmbeddingBuilder()
      .withId(EmbeddingIdValueObject.generate().value)
      .withKnowledgeBaseId(UuidValueObject.generate().value)
      .withDocumentId(UuidValueObject.generate().value)
      .withChunkId(UuidValueObject.generate().value)
      .withChunkText('text')
      .withChunkPosition(0)
      .withEmbedding(embedding)
      .withDimensions(dimensions)
      .withModel('m')
      .withCreatedAt(new Date())
      .withUpdatedAt(new Date())
      .build();
  }

  it('accepts a vector matching the given dimensions', () => {
    expect(() => buildWithVector(vector())).not.toThrow();
  });

  it('rejects a vector of the wrong dimension', () => {
    expect(() => buildWithVector([1, 2, 3])).toThrow(InvalidVectorException);
  });

  it('accepts a different dimension when both match', () => {
    expect(() => buildWithVector(new Array(768).fill(0.1), 768)).not.toThrow();
  });
});
