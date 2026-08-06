import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ChunkAggregate } from '@contexts/documents/domain/aggregates/chunk.aggregate';
import { IChunkWriteRepository } from '@contexts/documents/domain/repositories/write/chunk-write.repository';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';
import { createTenantRepository } from '@core/tenancy/create-tenant-repository.factory';
import { ChunkTypeOrmEntity } from '../entities/chunk.entity';
import { ChunkTypeOrmMapper } from '../mappers/chunk-typeorm.mapper';

@Injectable()
export class ChunkTypeOrmWriteRepository implements IChunkWriteRepository {
  private readonly repository: Repository<ChunkTypeOrmEntity>;

  constructor(
    private readonly mapper: ChunkTypeOrmMapper,
    @InjectRepository(ChunkTypeOrmEntity)
    private readonly rawRepository: Repository<ChunkTypeOrmEntity>,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {
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
    return entities.map((e) => this.mapper.toDomain(e));
  }
}
