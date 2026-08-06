import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { Repository } from 'typeorm';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { IDocumentWriteRepository } from '@contexts/documents/domain/repositories/write/document-write.repository';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';
import { createTenantRepository } from '@core/tenancy/create-tenant-repository.factory';
import { DocumentTypeOrmEntity } from '../entities/document.entity';
import { DocumentTypeOrmMapper } from '../mappers/document-typeorm.mapper';

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
    knowledgeBaseContext: KnowledgeBaseContext,
  ) {
    super();
    this.repository = createTenantRepository(
      rawRepository,
      knowledgeBaseContext,
    );
  }

  async findByCriteria(
    _criteria: Criteria,
  ): Promise<PaginatedResult<DocumentAggregate>> {
    throw new Error('Method not implemented.');
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
