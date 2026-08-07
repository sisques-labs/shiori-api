import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { Repository } from 'typeorm';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { IKnowledgeBaseWriteRepository } from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { KnowledgeBaseTypeOrmEntity } from '../entities/knowledge-base.entity';
import { KnowledgeBaseTypeOrmMapper } from '../mappers/knowledge-base-typeorm.mapper';

/**
 * Deliberately NOT wrapped by `createTenantRepository` — a knowledge base is
 * the tenant root itself, there is nothing above it to scope by (see
 * design.md).
 */
@Injectable()
export class KnowledgeBaseTypeOrmWriteRepository
  extends BaseDatabaseRepository
  implements IKnowledgeBaseWriteRepository
{
  constructor(
    private readonly mapper: KnowledgeBaseTypeOrmMapper,
    @InjectRepository(KnowledgeBaseTypeOrmEntity)
    private readonly repository: Repository<KnowledgeBaseTypeOrmEntity>,
  ) {
    super();
  }

  async findByCriteria(
    _criteria: Criteria,
  ): Promise<PaginatedResult<KnowledgeBaseAggregate>> {
    throw new Error('Method not implemented.');
  }

  async save(
    aggregate: KnowledgeBaseAggregate,
  ): Promise<KnowledgeBaseAggregate> {
    const entity = this.mapper.toPersistence(aggregate);
    const saved = await this.repository.save(entity);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<KnowledgeBaseAggregate | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
