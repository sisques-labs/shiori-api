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

import {
  IEmbeddingReadRepository,
  IEmbeddingSearchResult,
} from '@contexts/embeddings/domain/repositories/read/embedding-read.repository';
import { EmbeddingViewModel } from '@contexts/embeddings/domain/view-models/embedding.view-model';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';
import { createTenantRepository } from '@core/tenancy/create-tenant-repository.factory';
import { EmbeddingTypeOrmEntity } from '../entities/embedding.entity';
import { EmbeddingTypeOrmMapper } from '../mappers/embedding-typeorm.mapper';

const ALIAS = 'embedding';

interface RawSearchRow {
  chunkId: string;
  documentId: string;
  chunkText: string;
  chunkPosition: number;
  score: number;
}

/**
 * `search()` bypasses TypeORM's QueryBuilder DSL — it has no operator for
 * pgvector's `<=>` cosine-distance operator — and builds the `ORDER BY`
 * fragment by hand, binding the query vector as a parameter (never
 * string-interpolated). See design.md for why this needs no extra
 * dependency: the query-vector-to-pgvector-text-format conversion is the
 * same one-liner TypeORM's own driver uses internally for the `embedding`
 * column.
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
  ): Promise<IEmbeddingSearchResult[]> {
    const knowledgeBaseId = this.knowledgeBaseContext.require();
    const queryVector = this.toPgVectorLiteral(vector);

    const rows = await this.rawRepository
      .createQueryBuilder(ALIAS)
      .select(`${ALIAS}.chunk_id`, 'chunkId')
      .addSelect(`${ALIAS}.document_id`, 'documentId')
      .addSelect(`${ALIAS}.chunk_text`, 'chunkText')
      .addSelect(`${ALIAS}.chunk_position`, 'chunkPosition')
      .addSelect(`1 - (${ALIAS}.embedding <=> :queryVector)`, 'score')
      .where(`${ALIAS}.knowledge_base_id = :knowledgeBaseId`, {
        knowledgeBaseId,
      })
      .orderBy(`${ALIAS}.embedding <=> :queryVector`, 'ASC')
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
    return entity ? this.mapper.toViewModel(entity) : null;
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
    const items = entities.map((entity) => this.mapper.toViewModel(entity));
    return new PaginatedResult(items, total, page, limit);
  }

  async save(_viewModel: EmbeddingViewModel): Promise<void> {
    // read-side projection — write side handles persistence
  }

  async delete(_id: string): Promise<void> {
    // read-side projection — write side handles persistence
  }

  private toPgVectorLiteral(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }
}
