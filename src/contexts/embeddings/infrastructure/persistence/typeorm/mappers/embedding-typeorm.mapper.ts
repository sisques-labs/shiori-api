import { Injectable } from '@nestjs/common';

import { EmbeddingAggregate } from '@contexts/embeddings/domain/aggregates/embedding.aggregate';
import { EmbeddingBuilder } from '@contexts/embeddings/domain/builders/embedding.builder';
import { EmbeddingViewModel } from '@contexts/embeddings/domain/view-models/embedding.view-model';
import { EmbeddingTypeOrmEntity } from '../entities/embedding.entity';

@Injectable()
export class EmbeddingTypeOrmMapper {
  constructor(private readonly builder: EmbeddingBuilder) {}

  public toDomain(entity: EmbeddingTypeOrmEntity): EmbeddingAggregate {
    return this.builder
      .withId(entity.id)
      .withKnowledgeBaseId(entity.knowledgeBaseId)
      .withDocumentId(entity.documentId)
      .withChunkId(entity.chunkId)
      .withChunkText(entity.chunkText)
      .withChunkPosition(entity.chunkPosition)
      .withEmbedding(entity.embedding)
      .withModel(entity.model)
      .withCreatedAt(entity.createdAt)
      .build();
  }

  public toPersistence(aggregate: EmbeddingAggregate): EmbeddingTypeOrmEntity {
    const p = aggregate.toPrimitives();
    const entity = new EmbeddingTypeOrmEntity();
    entity.id = p.id;
    entity.knowledgeBaseId = p.knowledgeBaseId;
    entity.documentId = p.documentId;
    entity.chunkId = p.chunkId;
    entity.chunkText = p.chunkText;
    entity.chunkPosition = p.chunkPosition;
    entity.embedding = p.embedding;
    entity.model = p.model;
    entity.createdAt = p.createdAt;
    return entity;
  }

  public toViewModel(entity: EmbeddingTypeOrmEntity): EmbeddingViewModel {
    return this.builder
      .withId(entity.id)
      .withKnowledgeBaseId(entity.knowledgeBaseId)
      .withDocumentId(entity.documentId)
      .withChunkId(entity.chunkId)
      .withChunkText(entity.chunkText)
      .withChunkPosition(entity.chunkPosition)
      .withEmbedding(entity.embedding)
      .withModel(entity.model)
      .withCreatedAt(entity.createdAt)
      .buildViewModel();
  }
}
