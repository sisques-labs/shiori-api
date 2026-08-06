import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EmbeddingAggregate } from '@contexts/retrieval/domain/aggregates/embedding.aggregate';
import { IEmbeddingWriteRepository } from '@contexts/retrieval/domain/repositories/write/embedding-write.repository';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';
import { createTenantRepository } from '@core/tenancy/create-tenant-repository.factory';
import { EmbeddingTypeOrmEntity } from '../entities/embedding.entity';
import { EmbeddingTypeOrmMapper } from '../mappers/embedding-typeorm.mapper';

@Injectable()
export class EmbeddingTypeOrmWriteRepository implements IEmbeddingWriteRepository {
  private readonly repository: Repository<EmbeddingTypeOrmEntity>;

  constructor(
    private readonly mapper: EmbeddingTypeOrmMapper,
    @InjectRepository(EmbeddingTypeOrmEntity)
    private readonly rawRepository: Repository<EmbeddingTypeOrmEntity>,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {
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
}
