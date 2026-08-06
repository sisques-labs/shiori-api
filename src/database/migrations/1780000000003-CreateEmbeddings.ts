import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmbeddings1780000000003 implements MigrationInterface {
  name = 'CreateEmbeddings1780000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);

    await queryRunner.query(`
      CREATE TABLE "embeddings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "knowledge_base_id" uuid NOT NULL,
        "document_id" uuid NOT NULL,
        "chunk_id" uuid NOT NULL,
        "chunk_text" text NOT NULL,
        "chunk_position" integer NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "model" character varying(100) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_embeddings_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_embeddings_knowledge_base_id" ON "embeddings" ("knowledge_base_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_embeddings_document_id" ON "embeddings" ("document_id")`,
    );
    await queryRunner.query(`
      CREATE INDEX "IDX_embeddings_embedding_hnsw" ON "embeddings"
      USING hnsw ("embedding" vector_cosine_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_embeddings_embedding_hnsw"`);
    await queryRunner.query(`DROP INDEX "IDX_embeddings_document_id"`);
    await queryRunner.query(`DROP INDEX "IDX_embeddings_knowledge_base_id"`);
    await queryRunner.query(`DROP TABLE "embeddings"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "vector"`);
  }
}
