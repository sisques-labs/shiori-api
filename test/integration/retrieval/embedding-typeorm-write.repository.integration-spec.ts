import { randomUUID } from 'crypto';

import {
  createIntegrationModule,
  IntegrationContext,
} from '../../helpers/integration-bootstrap';
import { truncateAll } from '../../helpers/db-reset';
import { RetrievalModule } from '../../../src/contexts/retrieval/retrieval.module';
import { EmbeddingBuilder } from '../../../src/contexts/retrieval/domain/builders/embedding.builder';
import { EMBEDDING_VECTOR_DIMENSIONS } from '../../../src/contexts/retrieval/domain/value-objects/embedding-vector/embedding-vector.value-object';
import {
  EMBEDDING_WRITE_REPOSITORY,
  IEmbeddingWriteRepository,
} from '../../../src/contexts/retrieval/domain/repositories/write/embedding-write.repository';
import { KnowledgeBaseContext } from '../../../src/core/tenancy/knowledge-base-context.service';

function vector(fill = 0.1): number[] {
  return new Array(EMBEDDING_VECTOR_DIMENSIONS).fill(fill);
}

function buildEmbedding(
  knowledgeBaseId: string,
  documentId: string,
  position = 0,
  text = `chunk ${position}`,
) {
  return new EmbeddingBuilder()
    .withId(randomUUID())
    .withKnowledgeBaseId(knowledgeBaseId)
    .withDocumentId(documentId)
    .withChunkId(randomUUID())
    .withChunkText(text)
    .withChunkPosition(position)
    .withEmbedding(vector())
    .withModel('test-model')
    .withCreatedAt(new Date())
    .build();
}

describe('EmbeddingTypeOrmWriteRepository (integration)', () => {
  let ctx: IntegrationContext;
  let embeddingWriteRepo: IEmbeddingWriteRepository;
  let knowledgeBaseContext: KnowledgeBaseContext;

  beforeAll(async () => {
    ctx = await createIntegrationModule({ imports: [RetrievalModule] });
    embeddingWriteRepo = ctx.module.get(EMBEDDING_WRITE_REPOSITORY);
    knowledgeBaseContext = ctx.module.get(KnowledgeBaseContext);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
  });

  async function countByDocumentId(documentId: string): Promise<number> {
    const rows = await ctx.dataSource.query(
      'SELECT COUNT(*)::int AS count FROM embeddings WHERE document_id = $1',
      [documentId],
    );
    return rows[0].count;
  }

  describe('saveMany()', () => {
    it('bulk-inserts all embeddings, stamping the ambient knowledgeBaseId explicitly', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        const embeddings = [
          buildEmbedding(knowledgeBaseId, documentId, 0, 'first'),
          buildEmbedding(knowledgeBaseId, documentId, 1, 'second'),
        ];

        await embeddingWriteRepo.saveMany(embeddings);

        const rows = await ctx.dataSource.query(
          'SELECT knowledge_base_id, chunk_text FROM embeddings WHERE document_id = $1 ORDER BY chunk_position ASC',
          [documentId],
        );

        expect(rows).toHaveLength(2);
        expect(rows[0].knowledge_base_id).toBe(knowledgeBaseId);
        expect(rows[0].chunk_text).toBe('first');
        expect(rows[1].knowledge_base_id).toBe(knowledgeBaseId);
        expect(rows[1].chunk_text).toBe('second');
      });
    });

    it('with an empty array is a no-op', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await expect(embeddingWriteRepo.saveMany([])).resolves.toBeUndefined();
        expect(await countByDocumentId(documentId)).toBe(0);
      });
    });
  });

  describe('deleteByDocumentId()', () => {
    it('removes only embeddings for the given document', async () => {
      const knowledgeBaseId = randomUUID();
      const documentIdOne = randomUUID();
      const documentIdTwo = randomUUID();

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await embeddingWriteRepo.saveMany([
          buildEmbedding(knowledgeBaseId, documentIdOne, 0),
        ]);
        await embeddingWriteRepo.saveMany([
          buildEmbedding(knowledgeBaseId, documentIdTwo, 0),
        ]);

        await embeddingWriteRepo.deleteByDocumentId(documentIdOne);

        expect(await countByDocumentId(documentIdOne)).toBe(0);
        expect(await countByDocumentId(documentIdTwo)).toBe(1);
      });
    });
  });

  describe('deleteByKnowledgeBaseId()', () => {
    it('removes all embeddings for the knowledge base, independent of the ambient tenancy frame', async () => {
      const kbOneId = randomUUID();
      const kbTwoId = randomUUID();
      const documentIdOne = randomUUID();
      const documentIdTwo = randomUUID();

      await knowledgeBaseContext.run(kbOneId, () =>
        embeddingWriteRepo.saveMany([
          buildEmbedding(kbOneId, documentIdOne, 0),
        ]),
      );
      await knowledgeBaseContext.run(kbTwoId, () =>
        embeddingWriteRepo.saveMany([
          buildEmbedding(kbTwoId, documentIdTwo, 0),
        ]),
      );

      // Deliberately called from a different (or no) tenancy frame than
      // kbOneId, matching production usage from KnowledgeBaseDeletedListener.
      await knowledgeBaseContext.run(kbTwoId, () =>
        embeddingWriteRepo.deleteByKnowledgeBaseId(kbOneId),
      );

      expect(await countByDocumentId(documentIdOne)).toBe(0);
      expect(await countByDocumentId(documentIdTwo)).toBe(1);
    });
  });
});
