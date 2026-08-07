import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { Repository } from 'typeorm';

import { IKnowledgeBaseReadRepository } from '@contexts/knowledge-bases/domain/repositories/read/knowledge-base-read.repository';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
import { KnowledgeBaseTypeOrmEntity } from '../entities/knowledge-base.entity';
import { KnowledgeBaseTypeOrmMapper } from '../mappers/knowledge-base-typeorm.mapper';

/**
 * Deliberately NOT wrapped by `createTenantRepository` — see the write
 * repository's doc comment. `findByCriteria` has no transport surface in
 * this change (see proposal.md Deviation 1) and is stubbed like the write
 * side, matching the codebase's existing convention for unused interface
 * methods (e.g. `PlantTypeOrmWriteRepository.findByCriteria` in gardenia-api).
 */
@Injectable()
export class KnowledgeBaseTypeOrmReadRepository
  extends BaseDatabaseRepository
  implements IKnowledgeBaseReadRepository
{
  constructor(
    @InjectRepository(KnowledgeBaseTypeOrmEntity)
    private readonly repository: Repository<KnowledgeBaseTypeOrmEntity>,
    private readonly mapper: KnowledgeBaseTypeOrmMapper,
  ) {
    super();
  }

  async findById(id: string): Promise<KnowledgeBaseViewModel | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toViewModel(entity) : null;
  }

  async findByApiKeyHash(hash: string): Promise<KnowledgeBaseViewModel | null> {
    const entity = await this.repository.findOne({
      where: { apiKeyHash: hash },
    });
    return entity ? this.mapper.toViewModel(entity) : null;
  }

  async findByCriteria(
    _criteria: Criteria,
  ): Promise<PaginatedResult<KnowledgeBaseViewModel>> {
    throw new Error('Method not implemented.');
  }

  async save(_viewModel: KnowledgeBaseViewModel): Promise<void> {
    // read-side projection — write side handles persistence
  }

  async delete(_id: string): Promise<void> {
    // read-side projection — write side handles persistence
  }
}
