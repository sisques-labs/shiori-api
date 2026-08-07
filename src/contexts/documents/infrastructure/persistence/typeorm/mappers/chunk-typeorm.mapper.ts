import { Injectable } from '@nestjs/common';

import { ChunkAggregate } from '@contexts/documents/domain/aggregates/chunk.aggregate';
import { ChunkBuilder } from '@contexts/documents/domain/builders/chunk.builder';
import { ChunkTypeOrmEntity } from '../entities/chunk.entity';

@Injectable()
export class ChunkTypeOrmMapper {
  constructor(private readonly builder: ChunkBuilder) {}

  public toDomain(entity: ChunkTypeOrmEntity): ChunkAggregate {
    return this.builder
      .withId(entity.id)
      .withDocumentId(entity.documentId)
      .withKnowledgeBaseId(entity.knowledgeBaseId)
      .withPosition(entity.position)
      .withText(entity.text)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt)
      .build();
  }

  public toPersistence(aggregate: ChunkAggregate): ChunkTypeOrmEntity {
    const p = aggregate.toPrimitives();
    const entity = new ChunkTypeOrmEntity();
    entity.id = p.id;
    entity.documentId = p.documentId;
    entity.knowledgeBaseId = p.knowledgeBaseId;
    entity.position = p.position;
    entity.text = p.text;
    entity.createdAt = p.createdAt;
    entity.updatedAt = p.updatedAt;
    return entity;
  }
}
