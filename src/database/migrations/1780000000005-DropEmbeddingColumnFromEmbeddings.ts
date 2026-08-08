import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Splits the vector out of `embeddings` into per-dimension
 * `embedding_vectors_{dimension}` tables (created by the next migration) —
 * `embeddings` keeps every other column, both FKs, and both remaining
 * indexes exactly as-is. See design.md's "Normalized storage".
 *
 * No production data to preserve (explicit product decision, see
 * proposal.md) — `down()` re-adds the previous fixed `vector(1536)` column
 * and its HNSW index, matching `CreateEmbeddings1780000000003`'s original
 * shape, but does not attempt to restore any dropped vector values.
 */
export class DropEmbeddingColumnFromEmbeddings1780000000005 implements MigrationInterface {
  name = 'DropEmbeddingColumnFromEmbeddings1780000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_embeddings_embedding_hnsw"`,
    );
    await queryRunner.query(`ALTER TABLE "embeddings" DROP COLUMN "embedding"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Nullable first, then backfilled and constrained — the up() migration
    // may have run against a table with existing rows (their original
    // vector values are gone, per this change's explicit no-backfill
    // decision), so a straight NOT NULL add would fail on rollback.
    await queryRunner.query(`
      ALTER TABLE "embeddings" ADD COLUMN "embedding" vector(1536) NULL
    `);
    await queryRunner.query(`
      UPDATE "embeddings" SET "embedding" = array_fill(0, ARRAY[1536])::vector
      WHERE "embedding" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "embeddings" ALTER COLUMN "embedding" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_embeddings_embedding_hnsw" ON "embeddings"
      USING hnsw ("embedding" vector_cosine_ops)
    `);
  }
}
