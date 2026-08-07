import { Injectable } from '@nestjs/common';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { DocumentBuilder } from '@contexts/documents/domain/builders/document.builder';
import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';
import { DocumentTypeOrmEntity } from '../entities/document.entity';

@Injectable()
export class DocumentTypeOrmMapper {
  constructor(private readonly builder: DocumentBuilder) {}

  public toDomain(entity: DocumentTypeOrmEntity): DocumentAggregate {
    return this.builder
      .withId(entity.id)
      .withKnowledgeBaseId(entity.knowledgeBaseId)
      .withTitle(entity.title)
      .withContent(entity.content)
      .withStatus(entity.status)
      .withFailureReason(entity.failureReason)
      .withChunkCount(entity.chunkCount)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt)
      .build();
  }

  public toPersistence(aggregate: DocumentAggregate): DocumentTypeOrmEntity {
    const p = aggregate.toPrimitives();
    const entity = new DocumentTypeOrmEntity();
    entity.id = p.id;
    entity.knowledgeBaseId = p.knowledgeBaseId;
    entity.title = p.title;
    entity.content = p.content;
    entity.status = p.status;
    entity.failureReason = p.failureReason;
    entity.chunkCount = p.chunkCount;
    entity.createdAt = p.createdAt;
    entity.updatedAt = p.updatedAt;
    return entity;
  }

  public toViewModel(entity: DocumentTypeOrmEntity): DocumentViewModel {
    return this.builder
      .withId(entity.id)
      .withKnowledgeBaseId(entity.knowledgeBaseId)
      .withTitle(entity.title)
      .withContent(entity.content)
      .withStatus(entity.status)
      .withFailureReason(entity.failureReason)
      .withChunkCount(entity.chunkCount)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt)
      .buildViewModel();
  }
}
