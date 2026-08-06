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
import {
  EMBEDDING_READ_REPOSITORY,
  IEmbeddingReadRepository,
} from '../../../src/contexts/retrieval/domain/repositories/read/embedding-read.repository';
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
  vector: number[],
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
    ctx = await createIntegrationModule({ imports: [RetrievalModule] });
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

  describe('search()', () => {
    it('orders results nearest-first by cosine similarity and reports score as 1 - distance', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();

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
          nearVector,
          0,
          'near',
        );
        const mid = buildEmbedding(
          knowledgeBaseId,
          documentId,
          midVector,
          1,
          'mid',
        );
        const far = buildEmbedding(
          knowledgeBaseId,
          documentId,
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

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await writeRepo.saveMany([
          buildEmbedding(knowledgeBaseId, documentId, buildVector({ 0: 1 }), 0),
          buildEmbedding(knowledgeBaseId, documentId, buildVector({ 0: 1 }), 1),
          buildEmbedding(knowledgeBaseId, documentId, buildVector({ 0: 1 }), 2),
        ]);

        const results = await readRepo.search(queryVector, 2);

        expect(results).toHaveLength(2);
      });
    });

    it('scopes results to the current knowledge base only', async () => {
      const kbOneId = randomUUID();
      const kbTwoId = randomUUID();
      const documentId = randomUUID();
      const queryVector = buildVector({ 0: 1 });

      await knowledgeBaseContext.run(kbOneId, () =>
        writeRepo.saveMany([
          buildEmbedding(
            kbOneId,
            documentId,
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
            documentId,
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
