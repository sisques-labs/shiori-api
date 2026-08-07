import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
  SortDirection,
} from '@sisques-labs/nestjs-kit';
import { applyCriteriaToQueryBuilder } from '@sisques-labs/nestjs-kit/typeorm';
import { Repository } from 'typeorm';

import { EmbeddingAggregate } from '@contexts/embeddings/domain/aggregates/embedding.aggregate';
import { IEmbeddingWriteRepository } from '@contexts/embeddings/domain/repositories/write/embedding-write.repository';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';
import { createTenantRepository } from '@core/tenancy/create-tenant-repository.factory';
import { EmbeddingTypeOrmEntity } from '../entities/embedding.entity';
import { EmbeddingTypeOrmMapper } from '../mappers/embedding-typeorm.mapper';

const ALIAS = 'embedding';

@Injectable()
export class EmbeddingTypeOrmWriteRepository
  extends BaseDatabaseRepository
  implements IEmbeddingWriteRepository
{
  private readonly repository: Repository<EmbeddingTypeOrmEntity>;

  constructor(
    private readonly mapper: EmbeddingTypeOrmMapper,
    @InjectRepository(EmbeddingTypeOrmEntity)
    private readonly rawRepository: Repository<EmbeddingTypeOrmEntity>,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {
    super();
    this.repository = createTenantRepository(
      rawRepository,
      knowledgeBaseContext,
    );
  }

  async saveMany(embeddings: EmbeddingAggregate[]): Promise<void> {
    if (embeddings.length === 0) return;

    const knowledgeBaseId = this.knowledgeBaseContext.require();
    const entities = embeddings.map((embedding) => {
      const entity = this.mapper.toPersistence(embedding);
      entity.knowledgeBaseId = knowledgeBaseId;
      return entity;
    });

    // Bulk insert bypasses the tenant-repo proxy, whose `save` interceptor
    // only handles a single entity — stamped explicitly above instead.
    await this.rawRepository.save(entities);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.repository.delete({ documentId });
  }

  async deleteByKnowledgeBaseId(knowledgeBaseId: string): Promise<void> {
    // Deletes the whole tenant's embeddings by the given id directly,
    // rather than via the tenant-repo proxy's ambient KnowledgeBaseContext
    // — this is the "delete everything for this tenant" path itself, so it
    // shouldn't depend on already being inside a matching tenancy frame.
    await this.rawRepository.delete({ knowledgeBaseId });
  }

  async findById(id: string): Promise<EmbeddingAggregate | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<EmbeddingAggregate>> {
    const { page, limit, skip } = await this.calculatePagination(criteria);

    // createQueryBuilder bypasses the tenant-repo proxy, so the scoping
    // filter has to be applied explicitly here (mirrors the document repos).
    const queryBuilder = this.repository
      .createQueryBuilder(ALIAS)
      .where(`${ALIAS}.knowledge_base_id = :knowledgeBaseId`, {
        knowledgeBaseId: this.knowledgeBaseContext.require(),
      })
      .skip(skip)
      .take(limit);

    applyCriteriaToQueryBuilder(queryBuilder, criteria, {
      alias: ALIAS,
      defaultSort: { field: 'createdAt', direction: SortDirection.DESC },
    });

    const [entities, total] = await queryBuilder.getManyAndCount();
    const items = entities.map((entity) => this.mapper.toDomain(entity));
    return new PaginatedResult(items, total, page, limit);
  }

  async save(aggregate: EmbeddingAggregate): Promise<EmbeddingAggregate> {
    const entity = this.mapper.toPersistence(aggregate);
    const saved = await this.repository.save(entity);
    return this.mapper.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
