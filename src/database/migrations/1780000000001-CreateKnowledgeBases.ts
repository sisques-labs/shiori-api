import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeBases1780000000001 implements MigrationInterface {
  name = 'CreateKnowledgeBases1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First migration in this service — nothing upstream guarantees the
    // extension backing uuid_generate_v4() exists on a fresh database.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE "knowledge_bases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "description" text NULL,
        "api_key_hash" character varying(64) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_bases_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_knowledge_bases_api_key_hash" ON "knowledge_bases" ("api_key_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_knowledge_bases_api_key_hash"`);
    await queryRunner.query(`DROP TABLE "knowledge_bases"`);
  }
}
