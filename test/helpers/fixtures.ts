import { DataSource } from 'typeorm';

import { DocumentStatusEnum } from '../../src/contexts/documents/domain/enums/document-status.enum';

/**
 * Inserts a minimal parent row directly via SQL — used only to satisfy FK
 * constraints in integration specs that exercise a child table (documents,
 * chunks) in isolation from the owning context's own write path.
 */
export async function insertKnowledgeBaseFixture(
  dataSource: DataSource,
  id: string,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO "knowledge_bases" ("id", "name", "api_key_hash") VALUES ($1, $2, $3)`,
    [id, `Fixture KB ${id}`, `fixture-hash-${id}`],
  );
}

export async function insertDocumentFixture(
  dataSource: DataSource,
  id: string,
  knowledgeBaseId: string,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO "documents" ("id", "knowledge_base_id", "title", "content", "status") VALUES ($1, $2, $3, $4, $5)`,
    [
      id,
      knowledgeBaseId,
      `Fixture Doc ${id}`,
      'Fixture content',
      DocumentStatusEnum.PENDING,
    ],
  );
}
