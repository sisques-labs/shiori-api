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
import { NoEmbeddingTableForDimensionException } from '../../../src/contexts/embeddings/domain/exceptions/no-embedding-table-for-dimension.exception';
import {
  EMBEDDING_WRITE_REPOSITORY,
  IEmbeddingWriteRepository,
} from '../../../src/contexts/embeddings/domain/repositories/write/embedding-write.repository';
import {
  EMBEDDING_READ_REPOSITORY,
  IEmbeddingReadRepository,
} from '../../../src/contexts/embeddings/domain/repositories/read/embedding-read.repository';
import { KnowledgeBaseContext } from '../../../src/core/tenancy/knowledge-base-context.service';

/** A vector of the given dimension that is all zeros except the overrides. */
function buildVector(
  dimensions: number,
  overrides: Record<number, number> = {},
): number[] {
  const vector = new Array(dimensions).fill(0);
  for (const [index, value] of Object.entries(overrides)) {
    vector[Number(index)] = value;
  }
  return vector;
}

function buildEmbedding(
  knowledgeBaseId: string,
  documentId: string,
  chunkId: string,
  vector: number[],
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
    .withEmbedding(vector)
    .withDimensions(vector.length)
    .withModel(model)
    .withCreatedAt(new Date())
    .withUpdatedAt(new Date())
    .build();
}

describe('EmbeddingTypeOrmReadRepository (integration)', () => {
  let ctx: IntegrationContext;
  let writeRepo: IEmbeddingWriteRepository;
  let readRepo: IEmbeddingReadRepository;
  let knowledgeBaseContext: KnowledgeBaseContext;

  beforeAll(async () => {
    ctx = await createIntegrationModule({ imports: [EmbeddingsModule] });
    writeRepo = ctx.module.get(EMBEDDING_WRITE_REPOSITORY);
    readRepo = ctx.module.get(EMBEDDING_READ_REPOSITORY);
    knowledgeBaseContext = ctx.module.get(KnowledgeBaseContext);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
  });

  async function seedDocument(
    knowledgeBaseId: string,
    documentId: string,
  ): Promise<void> {
    await insertKnowledgeBaseFixture(ctx.dataSource, knowledgeBaseId);
    await insertDocumentFixture(ctx.dataSource, documentId, knowledgeBaseId);
  }

  describe('search()', () => {
    it('orders results nearest-first by cosine similarity and reports score as 1 - distance', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();
      const chunkIdNear = randomUUID();
      const chunkIdMid = randomUUID();
      const chunkIdFar = randomUUID();
      await seedDocument(knowledgeBaseId, documentId);
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdNear,
        documentId,
        knowledgeBaseId,
        0,
      );
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdMid,
        documentId,
        knowledgeBaseId,
        1,
      );
      await insertChunkFixture(
        ctx.dataSource,
        chunkIdFar,
        documentId,
        knowledgeBaseId,
        2,
      );

      // Query vector points purely along dimension 0.
      const queryVector = buildVector(1536, { 0: 1 });
      // Identical direction to the query -> cosine similarity 1.
      const nearVector = buildVector(1536, { 0: 1 });
      // 45 degrees off the query -> cosine similarity 1/sqrt(2) ~= 0.7071.
      const midVector = buildVector(1536, { 0: 1, 1: 1 });
      // Opposite direction to the query -> cosine similarity -1.
      const farVector = buildVector(1536, { 0: -1 });

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        const near = buildEmbedding(
          knowledgeBaseId,
          documentId,
          chunkIdNear,
          nearVector,
          0,
          'near',
        );
        const mid = buildEmbedding(
          knowledgeBaseId,
          documentId,
          chunkIdMid,
          midVector,
          1,
          'mid',
        );
        const far = buildEmbedding(
          knowledgeBaseId,
          documentId,
          chunkIdFar,
          farVector,
          2,
          'far',
        );
        // Insert out of similarity order to prove the repository, not the
        // insert order, determines the result ordering.
        await writeRepo.saveMany([far, near, mid], 1536);

        const results = await readRepo.search(
          queryVector,
          3,
          1536,
          'test-model',
        );

        expect(results).toHaveLength(3);
        expect(results.map((r) => r.chunkText)).toEqual(['near', 'mid', 'far']);
        expect(results[0].score).toBeCloseTo(1, 5);
        expect(results[1].score).toBeCloseTo(1 / Math.sqrt(2), 5);
        expect(results[2].score).toBeCloseTo(-1, 5);
        expect(results[0].documentId).toBe(documentId);
        expect(results[0].chunkPosition).toBe(0);
      });
    });

    it('limits results to topK', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();
      const queryVector = buildVector(1536, { 0: 1 });
      const chunkIds = [randomUUID(), randomUUID(), randomUUID()];
      await seedDocument(knowledgeBaseId, documentId);
      for (const [i, chunkId] of chunkIds.entries()) {
        await insertChunkFixture(
          ctx.dataSource,
          chunkId,
          documentId,
          knowledgeBaseId,
          i,
        );
      }

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await writeRepo.saveMany(
          [
            buildEmbedding(
              knowledgeBaseId,
              documentId,
              chunkIds[0],
              buildVector(1536, { 0: 1 }),
              0,
            ),
            buildEmbedding(
              knowledgeBaseId,
              documentId,
              chunkIds[1],
              buildVector(1536, { 0: 1 }),
              1,
            ),
            buildEmbedding(
              knowledgeBaseId,
              documentId,
              chunkIds[2],
              buildVector(1536, { 0: 1 }),
              2,
            ),
          ],
          1536,
        );

        const results = await readRepo.search(
          queryVector,
          2,
          1536,
          'test-model',
        );

        expect(results).toHaveLength(2);
      });
    });

    it('scopes results to the current knowledge base only', async () => {
      const kbOneId = randomUUID();
      const kbTwoId = randomUUID();
      const documentIdOne = randomUUID();
      const documentIdTwo = randomUUID();
      const chunkIdOne = randomUUID();
      const chunkIdTwo = randomUUID();
      const queryVector = buildVector(1536, { 0: 1 });
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
        writeRepo.saveMany(
          [
            buildEmbedding(
              kbOneId,
              documentIdOne,
              chunkIdOne,
              buildVector(1536, { 0: 1 }),
              0,
              'kb one chunk',
            ),
          ],
          1536,
        ),
      );
      await knowledgeBaseContext.run(kbTwoId, () =>
        writeRepo.saveMany(
          [
            buildEmbedding(
              kbTwoId,
              documentIdTwo,
              chunkIdTwo,
              buildVector(1536, { 0: 1 }),
              0,
              'kb two chunk',
            ),
          ],
          1536,
        ),
      );

      await knowledgeBaseContext.run(kbOneId, async () => {
        const results = await readRepo.search(
          queryVector,
          10,
          1536,
          'test-model',
        );

        expect(results).toHaveLength(1);
        expect(results[0].chunkText).toBe('kb one chunk');
      });
    });

    it('two knowledge bases sharing a dimension (SC-06) only ever see their own rows', async () => {
      const kbOneId = randomUUID();
      const kbTwoId = randomUUID();
      const documentIdOne = randomUUID();
      const documentIdTwo = randomUUID();
      const chunkIdOne = randomUUID();
      const chunkIdTwo = randomUUID();
      const queryVector = buildVector(1536, { 0: 1 });
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

      // Both models are 1536-dim, so both land in embedding_vectors_1536 —
      // tenant scoping must still hold via the embeddings join.
      await knowledgeBaseContext.run(kbOneId, () =>
        writeRepo.saveMany(
          [
            buildEmbedding(
              kbOneId,
              documentIdOne,
              chunkIdOne,
              buildVector(1536, { 0: 1 }),
              0,
              'kb one chunk',
              'text-embedding-3-small',
            ),
          ],
          1536,
        ),
      );
      await knowledgeBaseContext.run(kbTwoId, () =>
        writeRepo.saveMany(
          [
            buildEmbedding(
              kbTwoId,
              documentIdTwo,
              chunkIdTwo,
              buildVector(1536, { 0: 1 }),
              0,
              'kb two chunk',
              'text-embedding-ada-002',
            ),
          ],
          1536,
        ),
      );

      await knowledgeBaseContext.run(kbOneId, async () => {
        const results = await readRepo.search(
          queryVector,
          10,
          1536,
          'text-embedding-3-small',
        );
        expect(results).toHaveLength(1);
        expect(results[0].chunkText).toBe('kb one chunk');
      });
      await knowledgeBaseContext.run(kbTwoId, async () => {
        const results = await readRepo.search(
          queryVector,
          10,
          1536,
          'text-embedding-ada-002',
        );
        expect(results).toHaveLength(1);
        expect(results[0].chunkText).toBe('kb two chunk');
      });
    });

    it('same knowledge base, two models sharing a dimension: search only sees the queried model’s rows', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();
      const chunkIdOld = randomUUID();
      const chunkIdNew = randomUUID();
      const queryVector = buildVector(1536, { 0: 1 });
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

      // Simulates rows left behind by a prior model — e.g. after a
      // Knowledge Base's embeddingModel changed to a different model that
      // happens to share the same dimension count. Both land in
      // embedding_vectors_1536, so only the `model` filter (not dimension
      // or knowledge_base_id alone) can tell them apart.
      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await writeRepo.saveMany(
          [
            buildEmbedding(
              knowledgeBaseId,
              documentId,
              chunkIdOld,
              buildVector(1536, { 0: 1 }),
              0,
              'old model chunk',
              'text-embedding-ada-002',
            ),
          ],
          1536,
        );
        await writeRepo.saveMany(
          [
            buildEmbedding(
              knowledgeBaseId,
              documentId,
              chunkIdNew,
              buildVector(1536, { 0: 1 }),
              1,
              'new model chunk',
              'text-embedding-3-small',
            ),
          ],
          1536,
        );

        const results = await readRepo.search(
          queryVector,
          10,
          1536,
          'text-embedding-3-small',
        );

        expect(results).toHaveLength(1);
        expect(results[0].chunkText).toBe('new model chunk');
      });
    });

    it('only touches the table matching the resolved dimension, ignoring embeddings under a different dimension', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();
      const chunkId1536 = randomUUID();
      const chunkId768 = randomUUID();
      await seedDocument(knowledgeBaseId, documentId);
      await insertChunkFixture(
        ctx.dataSource,
        chunkId1536,
        documentId,
        knowledgeBaseId,
        0,
      );
      await insertChunkFixture(
        ctx.dataSource,
        chunkId768,
        documentId,
        knowledgeBaseId,
        1,
      );

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await writeRepo.saveMany(
          [
            buildEmbedding(
              knowledgeBaseId,
              documentId,
              chunkId1536,
              buildVector(1536, { 0: 1 }),
              0,
              '1536-dim chunk',
              'text-embedding-3-small',
            ),
          ],
          1536,
        );
        await writeRepo.saveMany(
          [
            buildEmbedding(
              knowledgeBaseId,
              documentId,
              chunkId768,
              buildVector(768, { 0: 1 }),
              1,
              '768-dim chunk',
              'nomic-embed-text',
            ),
          ],
          768,
        );

        const results1536 = await readRepo.search(
          buildVector(1536, { 0: 1 }),
          10,
          1536,
          'text-embedding-3-small',
        );
        expect(results1536).toHaveLength(1);
        expect(results1536[0].chunkText).toBe('1536-dim chunk');

        const results768 = await readRepo.search(
          buildVector(768, { 0: 1 }),
          10,
          768,
          'nomic-embed-text',
        );
        expect(results768).toHaveLength(1);
        expect(results768[0].chunkText).toBe('768-dim chunk');
      });
    });

    it('throws NoEmbeddingTableForDimensionException for an unregistered dimension', async () => {
      await knowledgeBaseContext.run(randomUUID(), async () => {
        await expect(
          readRepo.search(buildVector(999, { 0: 1 }), 10, 999, 'test-model'),
        ).rejects.toBeInstanceOf(NoEmbeddingTableForDimensionException);
      });
    });
  });
});
