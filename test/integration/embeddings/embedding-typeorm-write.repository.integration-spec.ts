import { randomUUID } from 'crypto';

import {
  createIntegrationModule,
  IntegrationContext,
} from '../../helpers/integration-bootstrap';
import { truncateAll } from '../../helpers/db-reset';
import {
  insertChunkFixture,
  insertDocumentFixture,
  insertKnowledgeBaseFixture,
} from '../../helpers/fixtures';
import { EmbeddingsModule } from '../../../src/contexts/embeddings/embeddings.module';
import { EmbeddingBuilder } from '../../../src/contexts/embeddings/domain/builders/embedding.builder';
import {
  EMBEDDING_WRITE_REPOSITORY,
  IEmbeddingWriteRepository,
} from '../../../src/contexts/embeddings/domain/repositories/write/embedding-write.repository';
import { KnowledgeBaseContext } from '../../../src/core/tenancy/knowledge-base-context.service';

function vector(dimensions: number, fill = 0.1): number[] {
  return new Array(dimensions).fill(fill);
}

function buildEmbedding(
  knowledgeBaseId: string,
  documentId: string,
  chunkId: string,
  dimensions: number,
  position = 0,
  text = `chunk ${position}`,
  model = 'test-model',
) {
  return new EmbeddingBuilder()
    .withId(randomUUID())
    .withKnowledgeBaseId(knowledgeBaseId)
    .withDocumentId(documentId)
    .withChunkId(chunkId)
    .withChunkText(text)
    .withChunkPosition(position)
    .withEmbedding(vector(dimensions))
    .withDimensions(dimensions)
    .withModel(model)
    .withCreatedAt(new Date())
    .withUpdatedAt(new Date())
    .build();
}

describe('EmbeddingTypeOrmWriteRepository (integration)', () => {
  let ctx: IntegrationContext;
  let embeddingWriteRepo: IEmbeddingWriteRepository;
  let knowledgeBaseContext: KnowledgeBaseContext;

  beforeAll(async () => {
    ctx = await createIntegrationModule({ imports: [EmbeddingsModule] });
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

  async function countVectorRows(
    dimensions: number,
    embeddingId: string,
  ): Promise<number> {
    const rows = await ctx.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM embedding_vectors_${dimensions} WHERE embedding_id = $1`,
      [embeddingId],
    );
    return rows[0].count;
  }

  async function seedDocument(
    knowledgeBaseId: string,
    documentId: string,
  ): Promise<void> {
    await insertKnowledgeBaseFixture(ctx.dataSource, knowledgeBaseId);
    await insertDocumentFixture(ctx.dataSource, documentId, knowledgeBaseId);
  }

  describe('saveMany()', () => {
    it('bulk-inserts both the metadata row and the matching embedding_vectors_{dimensions} row', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();
      const chunkIdOne = randomUUID();
      const chunkIdTwo = randomUUID();
      await seedDocument(knowledgeBaseId, documentId);
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdOne,
        documentId,
        knowledgeBaseId,
        0,
      );
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdTwo,
        documentId,
        knowledgeBaseId,
        1,
      );

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        const embeddings = [
          buildEmbedding(
            knowledgeBaseId,
            documentId,
            chunkIdOne,
            1536,
            0,
            'first',
          ),
          buildEmbedding(
            knowledgeBaseId,
            documentId,
            chunkIdTwo,
            1536,
            1,
            'second',
          ),
        ];

        await embeddingWriteRepo.saveMany(embeddings, 1536);

        const rows = await ctx.dataSource.query(
          'SELECT id, knowledge_base_id, chunk_text FROM embeddings WHERE document_id = $1 ORDER BY chunk_position ASC',
          [documentId],
        );

        expect(rows).toHaveLength(2);
        expect(rows[0].knowledge_base_id).toBe(knowledgeBaseId);
        expect(rows[0].chunk_text).toBe('first');
        expect(rows[1].knowledge_base_id).toBe(knowledgeBaseId);
        expect(rows[1].chunk_text).toBe('second');

        expect(await countVectorRows(1536, rows[0].id)).toBe(1);
        expect(await countVectorRows(1536, rows[1].id)).toBe(1);

        // embeddings.embedding column no longer exists — the metadata table
        // is pure metadata now.
        const columns = await ctx.dataSource.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'embeddings'`,
        );
        expect(
          columns.some(
            (c: { column_name: string }) => c.column_name === 'embedding',
          ),
        ).toBe(false);
      });
    });

    it('writes to different embedding_vectors_{dimension} tables depending on the given dimensions', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();
      const chunkIdSmall = randomUUID();
      const chunkIdLarge = randomUUID();
      await seedDocument(knowledgeBaseId, documentId);
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdSmall,
        documentId,
        knowledgeBaseId,
        0,
      );
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdLarge,
        documentId,
        knowledgeBaseId,
        1,
      );

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        const small = buildEmbedding(
          knowledgeBaseId,
          documentId,
          chunkIdSmall,
          768,
          0,
          'small',
          'nomic-embed-text',
        );
        const large = buildEmbedding(
          knowledgeBaseId,
          documentId,
          chunkIdLarge,
          3072,
          1,
          'large',
          'text-embedding-3-large',
        );

        await embeddingWriteRepo.saveMany([small], 768);
        await embeddingWriteRepo.saveMany([large], 3072);

        expect(await countVectorRows(768, small.id.value)).toBe(1);
        expect(await countVectorRows(3072, large.id.value)).toBe(1);
        // Neither row leaked into the other dimension's table.
        expect(await countVectorRows(3072, small.id.value)).toBe(0);
        expect(await countVectorRows(768, large.id.value)).toBe(0);
      });
    });

    it('with an empty array is a no-op', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await expect(
          embeddingWriteRepo.saveMany([], 1536),
        ).resolves.toBeUndefined();
        expect(await countByDocumentId(documentId)).toBe(0);
      });
    });
  });

  describe('deleteByDocumentId()', () => {
    it('removes only embeddings for the given document, cascading into the vector table with no dimension passed by the caller', async () => {
      const knowledgeBaseId = randomUUID();
      const documentIdOne = randomUUID();
      const documentIdTwo = randomUUID();
      const chunkIdOne = randomUUID();
      const chunkIdTwo = randomUUID();
      await seedDocument(knowledgeBaseId, documentIdOne);
      await insertDocumentFixture(
        ctx.dataSource,
        documentIdTwo,
        knowledgeBaseId,
      );
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdOne,
        documentIdOne,
        knowledgeBaseId,
      );
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdTwo,
        documentIdTwo,
        knowledgeBaseId,
      );

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        const embeddingOne = buildEmbedding(
          knowledgeBaseId,
          documentIdOne,
          chunkIdOne,
          1536,
          0,
        );
        const embeddingTwo = buildEmbedding(
          knowledgeBaseId,
          documentIdTwo,
          chunkIdTwo,
          1536,
          0,
        );
        await embeddingWriteRepo.saveMany([embeddingOne], 1536);
        await embeddingWriteRepo.saveMany([embeddingTwo], 1536);

        await embeddingWriteRepo.deleteByDocumentId(documentIdOne);

        expect(await countByDocumentId(documentIdOne)).toBe(0);
        expect(await countByDocumentId(documentIdTwo)).toBe(1);
        expect(await countVectorRows(1536, embeddingOne.id.value)).toBe(0);
        expect(await countVectorRows(1536, embeddingTwo.id.value)).toBe(1);
      });
    });
  });

  describe('deleteByKnowledgeBaseId()', () => {
    it('removes all embeddings for the knowledge base, independent of the ambient tenancy frame', async () => {
      const kbOneId = randomUUID();
      const kbTwoId = randomUUID();
      const documentIdOne = randomUUID();
      const documentIdTwo = randomUUID();
      const chunkIdOne = randomUUID();
      const chunkIdTwo = randomUUID();
      await seedDocument(kbOneId, documentIdOne);
      await seedDocument(kbTwoId, documentIdTwo);
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdOne,
        documentIdOne,
        kbOneId,
      );
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdTwo,
        documentIdTwo,
        kbTwoId,
      );

      await knowledgeBaseContext.run(kbOneId, () =>
        embeddingWriteRepo.saveMany(
          [buildEmbedding(kbOneId, documentIdOne, chunkIdOne, 1536, 0)],
          1536,
        ),
      );
      await knowledgeBaseContext.run(kbTwoId, () =>
        embeddingWriteRepo.saveMany(
          [buildEmbedding(kbTwoId, documentIdTwo, chunkIdTwo, 1536, 0)],
          1536,
        ),
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

  describe('deleteByKnowledgeBaseIdAndModel()', () => {
    it('removes only the given model’s rows, leaving another model for the same tenant untouched even when both share a dimension', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();
      const chunkIdOld = randomUUID();
      const chunkIdNew = randomUUID();
      await seedDocument(knowledgeBaseId, documentId);
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdOld,
        documentId,
        knowledgeBaseId,
        0,
      );
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdNew,
        documentId,
        knowledgeBaseId,
        1,
      );

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        // Both 1536-dim (text-embedding-3-small and text-embedding-ada-002
        // share a dimension/table), disambiguated only by `model`.
        const oldEmbedding = buildEmbedding(
          knowledgeBaseId,
          documentId,
          chunkIdOld,
          1536,
          0,
          'old',
          'text-embedding-3-small',
        );
        const newEmbedding = buildEmbedding(
          knowledgeBaseId,
          documentId,
          chunkIdNew,
          1536,
          1,
          'new',
          'text-embedding-ada-002',
        );
        await embeddingWriteRepo.saveMany([oldEmbedding], 1536);
        await embeddingWriteRepo.saveMany([newEmbedding], 1536);

        await embeddingWriteRepo.deleteByKnowledgeBaseIdAndModel(
          knowledgeBaseId,
          'text-embedding-3-small',
        );

        const rows = await ctx.dataSource.query(
          'SELECT model FROM embeddings WHERE document_id = $1',
          [documentId],
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].model).toBe('text-embedding-ada-002');
        expect(await countVectorRows(1536, oldEmbedding.id.value)).toBe(0);
        expect(await countVectorRows(1536, newEmbedding.id.value)).toBe(1);
      });
    });
  });
});
