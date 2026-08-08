import { Injectable } from '@nestjs/common';

import { EmbeddingAggregate } from '@contexts/embeddings/domain/aggregates/embedding.aggregate';
import { EmbeddingBuilder } from '@contexts/embeddings/domain/builders/embedding.builder';
import { EmbeddingViewModel } from '@contexts/embeddings/domain/view-models/embedding.view-model';
import { EmbeddingTypeOrmEntity } from '../entities/embedding.entity';

/** Plain persistence shape for a `embedding_vectors_{dimension}` row. */
interface EmbeddingVectorRow {
  embeddingId: string;
  embedding: number[];
}

/**
 * `EmbeddingTypeOrmEntity` is pure metadata now — the vector lives in a
 * separately-fetched `embedding_vectors_{dimension}` row, so every method
 * here that needs to produce a full domain object also takes the vector
 * (and, for hydration, the dimension it was stored at) explicitly, rather
 * than reading it off the entity.
 */
@Injectable()
export class EmbeddingTypeOrmMapper {
  constructor(private readonly builder: EmbeddingBuilder) {}

  public toDomain(
    entity: EmbeddingTypeOrmEntity,
    vector: number[],
    dimensions: number,
  ): EmbeddingAggregate {
    return this.builder
      .withId(entity.id)
      .withKnowledgeBaseId(entity.knowledgeBaseId)
      .withDocumentId(entity.documentId)
      .withChunkId(entity.chunkId)
      .withChunkText(entity.chunkText)
      .withChunkPosition(entity.chunkPosition)
      .withEmbedding(vector)
      .withDimensions(dimensions)
      .withModel(entity.model)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt)
      .build();
  }

  /** Metadata row only — the `embeddings` table has no vector column. */
  public toPersistence(aggregate: EmbeddingAggregate): EmbeddingTypeOrmEntity {
    const p = aggregate.toPrimitives();
    const entity = new EmbeddingTypeOrmEntity();
    entity.id = p.id;
    entity.knowledgeBaseId = p.knowledgeBaseId;
    entity.documentId = p.documentId;
    entity.chunkId = p.chunkId;
    entity.chunkText = p.chunkText;
    entity.chunkPosition = p.chunkPosition;
    entity.model = p.model;
    entity.createdAt = p.createdAt;
    entity.updatedAt = p.updatedAt;
    return entity;
  }

  /**
   * The matching `embedding_vectors_{dimensions}` row — correlated to the
   * metadata row above by the aggregate's own (already client-generated)
   * id, never a separate round trip.
   */
  public toVectorPersistence(
    aggregate: EmbeddingAggregate,
  ): EmbeddingVectorRow {
    const p = aggregate.toPrimitives();
    return { embeddingId: p.id, embedding: p.embedding };
  }

  public toViewModel(
    entity: EmbeddingTypeOrmEntity,
    vector: number[],
  ): EmbeddingViewModel {
    return this.builder
      .withId(entity.id)
      .withKnowledgeBaseId(entity.knowledgeBaseId)
      .withDocumentId(entity.documentId)
      .withChunkId(entity.chunkId)
      .withChunkText(entity.chunkText)
      .withChunkPosition(entity.chunkPosition)
      .withEmbedding(vector)
      .withModel(entity.model)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt)
      .buildViewModel();
  }
}
