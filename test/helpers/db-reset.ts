import { DataSource } from 'typeorm';

/**
 * Application tables truncated between DB-backed test cases. Update this
 * list when a new @Entity is added so integration/E2E specs stay isolated
 * between tests.
 */
export const TRUNCATE_TABLES: readonly string[] = [
  'knowledge_bases',
  'documents',
  'chunks',
  'embeddings',
  // FK'd to embeddings.id (ON DELETE CASCADE) — TRUNCATE ... CASCADE below
  // would catch these automatically even if omitted, but listed explicitly
  // per this file's own "update when a new table is added" convention.
  'embedding_vectors_768',
  'embedding_vectors_1024',
  'embedding_vectors_1536',
  'embedding_vectors_3072',
];

/**
 * Truncates all application tables and restarts identity sequences.
 * Call in `beforeEach` in integration and E2E specs to guarantee isolation between tests.
 */
export async function truncateAll(dataSource: DataSource): Promise<void> {
  if (TRUNCATE_TABLES.length === 0) {
    return;
  }

  const tableList = TRUNCATE_TABLES.map((table) => `"${table}"`).join(', ');

  await dataSource.query(`TRUNCATE ${tableList} RESTART IDENTITY CASCADE`);
}
