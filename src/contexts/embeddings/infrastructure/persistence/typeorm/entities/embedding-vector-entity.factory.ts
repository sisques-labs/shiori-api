import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Type } from '@nestjs/common';

import { EMBEDDING_MODELS_REGISTRY } from '@contexts/embeddings/domain/constants/embedding-models-registry.constant';

/**
 * Shared shape for every per-dimension vector table: `embedding_id` (PK,
 * FK to `embeddings.id` at the DB level via the migration's `ON DELETE
 * CASCADE` — deliberately no `@ManyToOne`/relation decorator here, the
 * cascade is a DB-level concern, not something the write repository ever
 * needs to navigate in TypeORM's object graph) plus the vector itself.
 */
export abstract class EmbeddingVectorTypeOrmEntity {
  @PrimaryColumn({ name: 'embedding_id', type: 'uuid' })
  embeddingId!: string;
}

/**
 * `EmbeddingVectorTypeOrmEntity` deliberately does NOT declare `embedding`
 * itself — each per-dimension subclass owns that column (different
 * `vector(N)` width per dimension) — so callers going through the generic
 * `Type<EmbeddingVectorTypeOrmEntity>` map use this narrower row shape to
 * type a fetched row's vector.
 */
export interface EmbeddingVectorRow extends EmbeddingVectorTypeOrmEntity {
  embedding: number[];
}

/**
 * pgvector requires a fixed `vector(N)` column width, so one TypeORM
 * entity class (and physical table) is generated per distinct dimension in
 * the registry — see design.md's "Normalized storage: metadata table + one
 * vector table per dimension".
 */
export function createEmbeddingVectorTypeOrmEntity(
  dimensions: number,
): Type<EmbeddingVectorTypeOrmEntity> {
  @Entity(`embedding_vectors_${dimensions}`)
  class EmbeddingVectorEntityForDimension extends EmbeddingVectorTypeOrmEntity {
    @Column({ type: 'vector', length: dimensions })
    embedding!: number[];
  }

  Object.defineProperty(EmbeddingVectorEntityForDimension, 'name', {
    value: `EmbeddingVectorTypeOrmEntity${dimensions}`,
  });

  return EmbeddingVectorEntityForDimension;
}

export const EMBEDDING_DIMENSIONS: readonly number[] = [
  ...new Set(EMBEDDING_MODELS_REGISTRY.map((model) => model.dimensions)),
];

export const EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION = new Map<
  number,
  Type<EmbeddingVectorTypeOrmEntity>
>(
  EMBEDDING_DIMENSIONS.map((dimensions) => [
    dimensions,
    createEmbeddingVectorTypeOrmEntity(dimensions),
  ]),
);
