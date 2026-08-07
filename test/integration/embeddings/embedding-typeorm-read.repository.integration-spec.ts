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
import { EMBEDDING_VECTOR_DIMENSIONS } from '../../../src/contexts/embeddings/domain/value-objects/embedding-vector/embedding-vector.value-object';
import {
  EMBEDDING_WRITE_REPOSITORY,
  IEmbeddingWriteRepository,
} from '../../../src/contexts/embeddings/domain/repositories/write/embedding-write.repository';
import {
  EMBEDDING_READ_REPOSITORY,
  IEmbeddingReadRepository,
} from '../../../src/contexts/embeddings/domain/repositories/read/embedding-read.repository';
import { KnowledgeBaseContext } from '../../../src/core/tenancy/knowledge-base-context.service';

/** A 1536-dim vector that is all zeros except the given index/value pairs. */
function buildVector(overrides: Record<number, number> = {}): number[] {
  const vector = new Array(EMBEDDING_VECTOR_DIMENSIONS).fill(0);
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
) {
  return new EmbeddingBuilder()
    .withId(randomUUID())
    .withKnowledgeBaseId(knowledgeBaseId)
    .withDocumentId(documentId)
    .withChunkId(chunkId)
    .withChunkText(text)
    .withChunkPosition(position)
    .withEmbedding(vector)
    .withModel('test-model')
    .withCreatedAt(new Date())
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
      const queryVector = buildVector({ 0: 1 });
      // Identical direction to the query -> cosine similarity 1.
      const nearVector = buildVector({ 0: 1 });
      // 45 degrees off the query -> cosine similarity 1/sqrt(2) ~= 0.7071.
      const midVector = buildVector({ 0: 1, 1: 1 });
      // Opposite direction to the query -> cosine similarity -1.
      const farVector = buildVector({ 0: -1 });

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
        await writeRepo.saveMany([far, near, mid]);

        const results = await readRepo.search(queryVector, 3);

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
      const queryVector = buildVector({ 0: 1 });
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
        await writeRepo.saveMany([
          buildEmbedding(
            knowledgeBaseId,
            documentId,
            chunkIds[0],
            buildVector({ 0: 1 }),
            0,
          ),
          buildEmbedding(
            knowledgeBaseId,
            documentId,
            chunkIds[1],
            buildVector({ 0: 1 }),
            1,
          ),
          buildEmbedding(
            knowledgeBaseId,
            documentId,
            chunkIds[2],
            buildVector({ 0: 1 }),
            2,
          ),
        ]);

        const results = await readRepo.search(queryVector, 2);

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
      const queryVector = buildVector({ 0: 1 });
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
        writeRepo.saveMany([
          buildEmbedding(
            kbOneId,
            documentIdOne,
            chunkIdOne,
            buildVector({ 0: 1 }),
            0,
            'kb one chunk',
          ),
        ]),
      );
      await knowledgeBaseContext.run(kbTwoId, () =>
        writeRepo.saveMany([
          buildEmbedding(
            kbTwoId,
            documentIdTwo,
            chunkIdTwo,
            buildVector({ 0: 1 }),
            0,
            'kb two chunk',
          ),
        ]),
      );

      await knowledgeBaseContext.run(kbOneId, async () => {
        const results = await readRepo.search(queryVector, 10);

        expect(results).toHaveLength(1);
        expect(results[0].chunkText).toBe('kb one chunk');
      });
    });
  });
});
