import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocuments1780000000002 implements MigrationInterface {
  name = 'CreateDocuments1780000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "knowledge_base_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "content" text NOT NULL,
        "status" character varying(16) NOT NULL,
        "failure_reason" text NULL,
        "chunk_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_documents_knowledge_base_id" FOREIGN KEY ("knowledge_base_id")
          REFERENCES "knowledge_bases" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_knowledge_base_id" ON "documents" ("knowledge_base_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "chunks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "knowledge_base_id" uuid NOT NULL,
        "position" integer NOT NULL,
        "text" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chunks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chunks_document_id" FOREIGN KEY ("document_id")
          REFERENCES "documents" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_chunks_document_id" ON "chunks" ("document_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_chunks_knowledge_base_id" ON "chunks" ("knowledge_base_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_chunks_knowledge_base_id"`);
    await queryRunner.query(`DROP INDEX "IDX_chunks_document_id"`);
    await queryRunner.query(`DROP TABLE "chunks"`);
    await queryRunner.query(`DROP INDEX "IDX_documents_knowledge_base_id"`);
    await queryRunner.query(`DROP TABLE "documents"`);
  }
}
