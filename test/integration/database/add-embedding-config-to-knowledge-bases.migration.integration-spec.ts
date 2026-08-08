import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';

import { AddEmbeddingConfigToKnowledgeBases1780000000004 } from '../../../src/database/migrations/1780000000004-AddEmbeddingConfigToKnowledgeBases';
import { getTestDataSourceOptions } from '../../helpers/test-data-source';

/**
 * Exercises the `up`/`down` of `AddEmbeddingConfigToKnowledgeBases1780000000004`
 * directly against a real Postgres connection, driven manually via
 * `QueryRunner` — including the backfill default for pre-existing rows.
 *
 * This spec shares the real test database with every other integration
 * spec (via the same `bootstrapTestDataSource()` migration runner, which
 * already applies this migration's `up()` once for the whole suite), so it
 * is deliberately self-healing around ordering: it tolerates the columns
 * already being present when it starts, and always restores the
 * post-migration schema in `afterAll` (via a real `up()` call, not just a
 * flag) so specs that run after this one — all of which depend on
 * `embedding_model`/`embedding_status` existing — are unaffected.
 */
describe('AddEmbeddingConfigToKnowledgeBases1780000000004 (integration)', () => {
  let dataSource: DataSource;
  const migration = new AddEmbeddingConfigToKnowledgeBases1780000000004();

  beforeAll(async () => {
    dataSource = new DataSource({
      ...getTestDataSourceOptions(),
      // Migrations are driven manually via QueryRunner in this spec, not
      // via dataSource.runMigrations() — the shared bootstrap already
      // creates the base `knowledge_bases` table this migration ALTERs.
      migrations: [],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    // Restore the fully-migrated schema for every other integration spec
    // that runs after this one, regardless of which branch below left it.
    if (!(await columnExists('embedding_model'))) {
      const queryRunner = dataSource.createQueryRunner();
      await migration.up(queryRunner);
      await queryRunner.release();
    }
    await dataSource.destroy();
  });

  async function columnExists(column: string): Promise<boolean> {
    const rows = await dataSource.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_bases' AND column_name = $1`,
      [column],
    );
    return rows.length > 0;
  }

  it('up() backfills existing rows before making embedding_model NOT NULL, and down() drops both columns', async () => {
    const queryRunner = dataSource.createQueryRunner();

    try {
      // Start from a known-clean slate regardless of what other integration
      // specs' shared bootstrap already applied.
      if (await columnExists('embedding_model')) {
        await migration.down(queryRunner);
      }
      expect(await columnExists('embedding_model')).toBe(false);
      expect(await columnExists('embedding_status')).toBe(false);

      // Pre-existing row, inserted before up() runs — exercises the
      // backfill path, not just a fresh-table default.
      const preExistingId = randomUUID();
      await queryRunner.query(
        `INSERT INTO "knowledge_bases" ("id", "name", "api_key_hash") VALUES ($1, $2, $3)`,
        [preExistingId, 'Pre-existing KB', `hash-${preExistingId}`],
      );

      await migration.up(queryRunner);

      expect(await columnExists('embedding_model')).toBe(true);
      expect(await columnExists('embedding_status')).toBe(true);

      const [backfilled] = await queryRunner.query(
        `SELECT "embedding_model", "embedding_status" FROM "knowledge_bases" WHERE "id" = $1`,
        [preExistingId],
      );
      expect(backfilled.embedding_model).toBe('text-embedding-3-small');
      expect(backfilled.embedding_status).toBe('READY');

      // NOT NULL is enforced going forward.
      await expect(
        queryRunner.query(
          `INSERT INTO "knowledge_bases" ("id", "name", "api_key_hash") VALUES ($1, $2, $3)`,
          [randomUUID(), 'No model KB', 'some-hash'],
        ),
      ).rejects.toThrow();

      // New rows can still set a different model explicitly; status
      // defaults to READY at the DB level.
      const newId = randomUUID();
      await queryRunner.query(
        `INSERT INTO "knowledge_bases" ("id", "name", "api_key_hash", "embedding_model") VALUES ($1, $2, $3, $4)`,
        [newId, 'New KB', `hash-${newId}`, 'nomic-embed-text'],
      );
      const [inserted] = await queryRunner.query(
        `SELECT "embedding_model", "embedding_status" FROM "knowledge_bases" WHERE "id" = $1`,
        [newId],
      );
      expect(inserted.embedding_model).toBe('nomic-embed-text');
      expect(inserted.embedding_status).toBe('READY');

      await migration.down(queryRunner);

      expect(await columnExists('embedding_model')).toBe(false);
      expect(await columnExists('embedding_status')).toBe(false);
    } finally {
      await queryRunner.query(`DELETE FROM "knowledge_bases"`);
      await queryRunner.release();
    }
  });
});
