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

import { ChunkAggregate } from '@contexts/documents/domain/aggregates/chunk.aggregate';
import { IChunkWriteRepository } from '@contexts/documents/domain/repositories/write/chunk-write.repository';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';
import { createTenantRepository } from '@core/tenancy/create-tenant-repository.factory';
import { ChunkTypeOrmEntity } from '../entities/chunk.entity';
import { ChunkTypeOrmMapper } from '../mappers/chunk-typeorm.mapper';

const ALIAS = 'chunk';

@Injectable()
export class ChunkTypeOrmWriteRepository
  extends BaseDatabaseRepository
  implements IChunkWriteRepository
{
  private readonly repository: Repository<ChunkTypeOrmEntity>;

  constructor(
    private readonly mapper: ChunkTypeOrmMapper,
    @InjectRepository(ChunkTypeOrmEntity)
    private readonly rawRepository: Repository<ChunkTypeOrmEntity>,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {
    super();
    this.repository = createTenantRepository(
      rawRepository,
      knowledgeBaseContext,
    );
  }

  async saveMany(chunks: ChunkAggregate[]): Promise<void> {
    if (chunks.length === 0) return;

    const knowledgeBaseId = this.knowledgeBaseContext.require();
    const entities = chunks.map((chunk) => {
      const entity = this.mapper.toPersistence(chunk);
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

  async findByDocumentId(documentId: string): Promise<ChunkAggregate[]> {
    const entities = await this.repository.find({
      where: { documentId },
      order: { position: 'ASC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async findById(id: string): Promise<ChunkAggregate | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<ChunkAggregate>> {
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

  async save(aggregate: ChunkAggregate): Promise<ChunkAggregate> {
    const entity = this.mapper.toPersistence(aggregate);
    const saved = await this.repository.save(entity);
    return this.mapper.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
