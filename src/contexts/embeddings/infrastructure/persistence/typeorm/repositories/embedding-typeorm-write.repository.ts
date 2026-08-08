import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
  SortDirection,
} from '@sisques-labs/nestjs-kit';
import { applyCriteriaToQueryBuilder } from '@sisques-labs/nestjs-kit/typeorm';
import { DataSource, Repository } from 'typeorm';

import { EmbeddingAggregate } from '@contexts/embeddings/domain/aggregates/embedding.aggregate';
import { NoEmbeddingTableForDimensionException } from '@contexts/embeddings/domain/exceptions/no-embedding-table-for-dimension.exception';
import { IEmbeddingWriteRepository } from '@contexts/embeddings/domain/repositories/write/embedding-write.repository';
import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';
import { createTenantRepository } from '@core/tenancy/create-tenant-repository.factory';
import {
  EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION,
  EmbeddingVectorRow,
} from '../entities/embedding-vector-entity.factory';
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
    private readonly modelRegistry: EmbeddingModelRegistryService,
    @InjectRepository(EmbeddingTypeOrmEntity)
    private readonly rawRepository: Repository<EmbeddingTypeOrmEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {
    super();
    this.repository = createTenantRepository(
      rawRepository,
      knowledgeBaseContext,
    );
  }

  async saveMany(
    embeddings: EmbeddingAggregate[],
    dimensions: number,
  ): Promise<void> {
    if (embeddings.length === 0) return;

    const vectorEntityClass =
      EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION.get(dimensions);
    if (!vectorEntityClass) {
      throw new NoEmbeddingTableForDimensionException(dimensions);
    }

    const knowledgeBaseId = this.knowledgeBaseContext.require();

    // Both tables are written in one transaction, correlated by each
    // aggregate's already client-generated id — no extra round trip needed
    // to link a metadata row to its vector row.
    await this.dataSource.transaction(async (manager) => {
      const metadataEntities = embeddings.map((embedding) => {
        const entity = this.mapper.toPersistence(embedding);
        entity.knowledgeBaseId = knowledgeBaseId;
        return entity;
      });
      await manager
        .getRepository(EmbeddingTypeOrmEntity)
        .save(metadataEntities);

      const vectorRows = embeddings.map((embedding) =>
        this.mapper.toVectorPersistence(embedding),
      );
      await manager.getRepository(vectorEntityClass).save(vectorRows);
    });
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    // Deletes from `embeddings` (metadata) only — `ON DELETE CASCADE`
    // removes the matching row from whichever `embedding_vectors_{dimension}`
    // table actually holds it. No dimension ever needs resolving here.
    await this.repository.delete({ documentId });
  }

  async deleteByKnowledgeBaseId(knowledgeBaseId: string): Promise<void> {
    // Deletes the whole tenant's embeddings by the given id directly,
    // rather than via the tenant-repo proxy's ambient KnowledgeBaseContext
    // — this is the "delete everything for this tenant" path itself, so it
    // shouldn't depend on already being inside a matching tenancy frame.
    await this.rawRepository.delete({ knowledgeBaseId });
  }

  async deleteByKnowledgeBaseIdAndModel(
    knowledgeBaseId: string,
    model: string,
  ): Promise<void> {
    // Used only by the re-embed pipeline — filters by `model`, not
    // dimension, so it can target exactly one model's rows for a tenant
    // even when the previous/new model share a dimension (and vector
    // table). Same "no ambient tenancy frame required" reasoning as
    // deleteByKnowledgeBaseId above.
    await this.rawRepository.delete({ knowledgeBaseId, model });
  }

  async findById(id: string): Promise<EmbeddingAggregate | null> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) return null;

    const { dimensions } = this.modelRegistry.getOrThrow(entity.model);
    const vectorEntityClass =
      EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION.get(dimensions);
    if (!vectorEntityClass) {
      throw new NoEmbeddingTableForDimensionException(dimensions);
    }
    const vectorRow = await this.fetchVectorRow(vectorEntityClass, id);

    return this.mapper.toDomain(entity, vectorRow?.embedding ?? [], dimensions);
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
    const items = await Promise.all(
      entities.map(async (entity) => {
        const { dimensions } = this.modelRegistry.getOrThrow(entity.model);
        const vectorEntityClass =
          EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION.get(dimensions);
        if (!vectorEntityClass) {
          throw new NoEmbeddingTableForDimensionException(dimensions);
        }
        const vectorRow = await this.fetchVectorRow(
          vectorEntityClass,
          entity.id,
        );
        return this.mapper.toDomain(
          entity,
          vectorRow?.embedding ?? [],
          dimensions,
        );
      }),
    );
    return new PaginatedResult(items, total, page, limit);
  }

  async save(aggregate: EmbeddingAggregate): Promise<EmbeddingAggregate> {
    const dimensions = aggregate.embedding.dimensions;
    await this.saveMany([aggregate], dimensions);
    return aggregate;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private async fetchVectorRow(
    vectorEntityClass: NonNullable<
      ReturnType<typeof EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION.get>
    >,
    embeddingId: string,
  ): Promise<EmbeddingVectorRow | null> {
    const row = await this.dataSource
      .getRepository(vectorEntityClass)
      .findOne({ where: { embeddingId } });
    return row as EmbeddingVectorRow | null;
  }
}
