import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  IEmbeddingReadRepository,
  IRetrievalSearchResult,
} from '@contexts/retrieval/domain/repositories/read/embedding-read.repository';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';
import { EmbeddingTypeOrmEntity } from '../entities/embedding.entity';

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
export class EmbeddingTypeOrmReadRepository implements IEmbeddingReadRepository {
  constructor(
    @InjectRepository(EmbeddingTypeOrmEntity)
    private readonly repository: Repository<EmbeddingTypeOrmEntity>,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {}

  async search(
    vector: number[],
    topK: number,
  ): Promise<IRetrievalSearchResult[]> {
    const knowledgeBaseId = this.knowledgeBaseContext.require();
    const queryVector = this.toPgVectorLiteral(vector);

    const rows = await this.repository
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

  private toPgVectorLiteral(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }
}
