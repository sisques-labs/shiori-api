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

import { IDocumentReadRepository } from '@contexts/documents/domain/repositories/read/document-read.repository';
import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';
import { createTenantRepository } from '@core/tenancy/create-tenant-repository.factory';
import { DocumentTypeOrmEntity } from '../entities/document.entity';
import { DocumentTypeOrmMapper } from '../mappers/document-typeorm.mapper';

const ALIAS = 'document';

@Injectable()
export class DocumentTypeOrmReadRepository
  extends BaseDatabaseRepository
  implements IDocumentReadRepository
{
  private readonly repository: Repository<DocumentTypeOrmEntity>;
  private readonly rawRepository: Repository<DocumentTypeOrmEntity>;

  constructor(
    @InjectRepository(DocumentTypeOrmEntity)
    rawRepository: Repository<DocumentTypeOrmEntity>,
    private readonly mapper: DocumentTypeOrmMapper,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {
    super();
    this.rawRepository = rawRepository;
    this.repository = createTenantRepository(
      rawRepository,
      knowledgeBaseContext,
    );
  }

  async findById(id: string): Promise<DocumentViewModel | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toViewModel(entity) : null;
  }

  async findIdsByKnowledgeBaseId(knowledgeBaseId: string): Promise<string[]> {
    // Explicit `knowledgeBaseId` given by the caller (the re-embed
    // pipeline, enumerating a specific tenant's documents) — queried via
    // the raw repository rather than the ambient tenant-repo proxy, same
    // reasoning as the other "whole tenant" operations in this codebase.
    const entities = await this.rawRepository.find({
      where: { knowledgeBaseId },
      select: { id: true },
    });
    return entities.map((entity) => entity.id);
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<DocumentViewModel>> {
    const { page, limit, skip } = await this.calculatePagination(criteria);

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
    const items = entities.map((e) => this.mapper.toViewModel(e));
    return new PaginatedResult(items, total, page, limit);
  }

  async save(_viewModel: DocumentViewModel): Promise<void> {
    // read-side projection — write side handles persistence
  }

  async delete(_id: string): Promise<void> {
    // read-side projection — write side handles persistence
  }
}
