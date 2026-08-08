import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes the embedding model a per-Knowledge-Base setting instead of a
 * global `.env` var. See openspec/changes/flexible-embedding-dimensions.
 */
export class AddEmbeddingConfigToKnowledgeBases1780000000004 implements MigrationInterface {
  name = 'AddEmbeddingConfigToKnowledgeBases1780000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_bases"
      ADD COLUMN "embedding_model" character varying(100) NULL
    `);
    // Backfill existing rows with the previous implicit global default
    // before making the column NOT NULL.
    await queryRunner.query(`
      UPDATE "knowledge_bases" SET "embedding_model" = 'text-embedding-3-small'
      WHERE "embedding_model" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_bases"
      ALTER COLUMN "embedding_model" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "knowledge_bases"
      ADD COLUMN "embedding_status" character varying(20) NOT NULL DEFAULT 'READY'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "knowledge_bases" DROP COLUMN "embedding_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "knowledge_bases" DROP COLUMN "embedding_model"
    `);
  }
}
