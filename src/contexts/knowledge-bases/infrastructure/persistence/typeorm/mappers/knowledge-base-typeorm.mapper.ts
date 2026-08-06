import { Injectable } from '@nestjs/common';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseBuilder } from '@contexts/knowledge-bases/domain/builders/knowledge-base.builder';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
import { KnowledgeBaseTypeOrmEntity } from '../entities/knowledge-base.entity';

@Injectable()
export class KnowledgeBaseTypeOrmMapper {
  constructor(private readonly builder: KnowledgeBaseBuilder) {}

  public toDomain(entity: KnowledgeBaseTypeOrmEntity): KnowledgeBaseAggregate {
    return this.builder
      .withId(entity.id)
      .withName(entity.name)
      .withDescription(entity.description)
      .withApiKeyHash(entity.apiKeyHash)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt)
      .build();
  }

  public toPersistence(
    aggregate: KnowledgeBaseAggregate,
  ): KnowledgeBaseTypeOrmEntity {
    const p = aggregate.toPrimitives();
    const entity = new KnowledgeBaseTypeOrmEntity();
    entity.id = p.id;
    entity.name = p.name;
    entity.description = p.description;
    entity.apiKeyHash = p.apiKeyHash;
    entity.createdAt = p.createdAt;
    entity.updatedAt = p.updatedAt;
    return entity;
  }

  public toViewModel(
    entity: KnowledgeBaseTypeOrmEntity,
  ): KnowledgeBaseViewModel {
    return this.builder
      .withId(entity.id)
      .withName(entity.name)
      .withDescription(entity.description)
      .withApiKeyHash(entity.apiKeyHash)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt)
      .buildViewModel();
  }
}
