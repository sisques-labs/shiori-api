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

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { IDocumentWriteRepository } from '@contexts/documents/domain/repositories/write/document-write.repository';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';
import { createTenantRepository } from '@core/tenancy/create-tenant-repository.factory';
import { DocumentTypeOrmEntity } from '../entities/document.entity';
import { DocumentTypeOrmMapper } from '../mappers/document-typeorm.mapper';

const ALIAS = 'document';

@Injectable()
export class DocumentTypeOrmWriteRepository
  extends BaseDatabaseRepository
  implements IDocumentWriteRepository
{
  private readonly repository: Repository<DocumentTypeOrmEntity>;

  constructor(
    private readonly mapper: DocumentTypeOrmMapper,
    @InjectRepository(DocumentTypeOrmEntity)
    rawRepository: Repository<DocumentTypeOrmEntity>,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {
    super();
    this.repository = createTenantRepository(
      rawRepository,
      knowledgeBaseContext,
    );
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<DocumentAggregate>> {
    const { page, limit, skip } = await this.calculatePagination(criteria);

    // createQueryBuilder bypasses the tenant-repo proxy, so the scoping
    // filter has to be applied explicitly here (mirrors the read repository).
    const qb = this.repository
      .createQueryBuilder(ALIAS)
      .where(`${ALIAS}.knowledge_base_id = :knowledgeBaseId`, {
        knowledgeBaseId: this.knowledgeBaseContext.require(),
      })
      .skip(skip)
      .take(limit);

    applyCriteriaToQueryBuilder(qb, criteria, {
      alias: ALIAS,
      defaultSort: { field: 'createdAt', direction: SortDirection.DESC },
    });

    const [entities, total] = await qb.getManyAndCount();
    const items = entities.map((entity) => this.mapper.toDomain(entity));
    return new PaginatedResult(items, total, page, limit);
  }

  async save(aggregate: DocumentAggregate): Promise<DocumentAggregate> {
    const entity = this.mapper.toPersistence(aggregate);
    const saved = await this.repository.save(entity);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<DocumentAggregate | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
