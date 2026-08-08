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

import { NoEmbeddingTableForDimensionException } from '@contexts/embeddings/domain/exceptions/no-embedding-table-for-dimension.exception';
import {
  IEmbeddingReadRepository,
  IEmbeddingSearchResult,
} from '@contexts/embeddings/domain/repositories/read/embedding-read.repository';
import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';
import { EmbeddingViewModel } from '@contexts/embeddings/domain/view-models/embedding.view-model';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';
import { createTenantRepository } from '@core/tenancy/create-tenant-repository.factory';
import {
  EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION,
  EmbeddingVectorRow,
} from '../entities/embedding-vector-entity.factory';
import { EmbeddingTypeOrmEntity } from '../entities/embedding.entity';
import { EmbeddingTypeOrmMapper } from '../mappers/embedding-typeorm.mapper';

const ALIAS = 'embedding';
const VECTOR_ALIAS = 'vector';

interface RawSearchRow {
  chunkId: string;
  documentId: string;
  chunkText: string;
  chunkPosition: number;
  score: number;
}

/**
 * `search()` bypasses TypeORM's QueryBuilder DSL — it has no operator for
 * pgvector's `<=>` cosine-distance operator — and builds the query by hand,
 * joining the (unchanged) `embeddings` metadata table against whichever
 * `embedding_vectors_{dimensions}` table the caller resolved, binding the
 * query vector as a parameter (never string-interpolated). See design.md
 * for the full rationale.
 */
@Injectable()
export class EmbeddingTypeOrmReadRepository
  extends BaseDatabaseRepository
  implements IEmbeddingReadRepository
{
  private readonly repository: Repository<EmbeddingTypeOrmEntity>;
  private readonly rawRepository: Repository<EmbeddingTypeOrmEntity>;

  constructor(
    @InjectRepository(EmbeddingTypeOrmEntity)
    rawRepository: Repository<EmbeddingTypeOrmEntity>,
    private readonly mapper: EmbeddingTypeOrmMapper,
    private readonly modelRegistry: EmbeddingModelRegistryService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {
    super();
    this.rawRepository = rawRepository;
    this.repository = createTenantRepository(
      rawRepository,
      knowledgeBaseContext,
    );
  }

  async search(
    vector: number[],
    topK: number,
    dimensions: number,
    model: string,
  ): Promise<IEmbeddingSearchResult[]> {
    const vectorEntityClass =
      EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION.get(dimensions);
    if (!vectorEntityClass) {
      throw new NoEmbeddingTableForDimensionException(dimensions);
    }
    const vectorTableName =
      this.dataSource.getRepository(vectorEntityClass).metadata.tableName;

    const knowledgeBaseId = this.knowledgeBaseContext.require();
    const queryVector = this.toPgVectorLiteral(vector);

    const rows = await this.rawRepository
      .createQueryBuilder(ALIAS)
      .innerJoin(
        vectorTableName,
        VECTOR_ALIAS,
        `${VECTOR_ALIAS}.embedding_id = ${ALIAS}.id`,
      )
      .select(`${ALIAS}.chunk_id`, 'chunkId')
      .addSelect(`${ALIAS}.document_id`, 'documentId')
      .addSelect(`${ALIAS}.chunk_text`, 'chunkText')
      .addSelect(`${ALIAS}.chunk_position`, 'chunkPosition')
      .addSelect(`1 - (${VECTOR_ALIAS}.embedding <=> :queryVector)`, 'score')
      .where(`${ALIAS}.knowledge_base_id = :knowledgeBaseId`, {
        knowledgeBaseId,
      })
      .andWhere(`${ALIAS}.model = :model`, { model })
      .orderBy(`${VECTOR_ALIAS}.embedding <=> :queryVector`, 'ASC')
      .setParameter('queryVector', queryVector)
      .limit(topK)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      chunkText: row.chunkText,
      chunkPosition: Number(row.chunkPosition),
      score: Number(row.score),
    }));
  }

  async findById(id: string): Promise<EmbeddingViewModel | null> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) return null;

    const { dimensions } = this.modelRegistry.getOrThrow(entity.model);
    const vectorEntityClass =
      EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION.get(dimensions);
    if (!vectorEntityClass) {
      throw new NoEmbeddingTableForDimensionException(dimensions);
    }
    const vectorRow = await this.fetchVectorRow(vectorEntityClass, id);

    return this.mapper.toViewModel(entity, vectorRow?.embedding ?? []);
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<EmbeddingViewModel>> {
    const { page, limit, skip } = await this.calculatePagination(criteria);

    const queryBuilder = this.rawRepository
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
        return this.mapper.toViewModel(entity, vectorRow?.embedding ?? []);
      }),
    );
    return new PaginatedResult(items, total, page, limit);
  }

  async save(_viewModel: EmbeddingViewModel): Promise<void> {
    // read-side projection — write side handles persistence
  }

  async delete(_id: string): Promise<void> {
    // read-side projection — write side handles persistence
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

  private toPgVectorLiteral(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }
}
