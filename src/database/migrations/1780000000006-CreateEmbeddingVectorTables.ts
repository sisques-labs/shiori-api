import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One minimal vector-only table per distinct dimension in
 * `EMBEDDING_MODELS_REGISTRY` at the time this migration was written —
 * `embedding_vectors_768` (nomic-embed-text), `embedding_vectors_1024`
 * (mxbai-embed-large), `embedding_vectors_1536` (text-embedding-3-small,
 * text-embedding-ada-002), `embedding_vectors_3072`
 * (text-embedding-3-large). Adding a model with a dimension not covered
 * here requires a new migration following this same shape — see
 * `src/contexts/embeddings/README.md`.
 */
export class CreateEmbeddingVectorTables1780000000006 implements MigrationInterface {
  name = 'CreateEmbeddingVectorTables1780000000006';

  private readonly dimensions = [768, 1024, 1536, 3072];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const dimension of this.dimensions) {
      await queryRunner.query(`
        CREATE TABLE "embedding_vectors_${dimension}" (
          "embedding_id" uuid NOT NULL,
          "embedding" vector(${dimension}) NOT NULL,
          CONSTRAINT "PK_embedding_vectors_${dimension}_id" PRIMARY KEY ("embedding_id"),
          CONSTRAINT "FK_embedding_vectors_${dimension}_embedding_id" FOREIGN KEY ("embedding_id")
            REFERENCES "embeddings" ("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "IDX_embedding_vectors_${dimension}_hnsw" ON "embedding_vectors_${dimension}"
        USING hnsw ("embedding" vector_cosine_ops)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const dimension of [...this.dimensions].reverse()) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_embedding_vectors_${dimension}_hnsw"`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "embedding_vectors_${dimension}"`,
      );
    }
  }
}
