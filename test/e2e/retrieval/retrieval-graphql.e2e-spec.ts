import { randomUUID } from 'crypto';

import { createE2EApp, E2EContext } from '../../helpers/app-bootstrap';
import { truncateAll } from '../../helpers/db-reset';
import { gql } from '../../helpers/graphql-client';
import {
  insertChunkFixture,
  insertDocumentFixture,
} from '../../helpers/fixtures';
import { EMBEDDING_PORT } from '../../../src/contexts/embeddings/application/ports/embedding.port';
import { EmbeddingBuilder } from '../../../src/contexts/embeddings/domain/builders/embedding.builder';
import {
  EMBEDDING_WRITE_REPOSITORY,
  IEmbeddingWriteRepository,
} from '../../../src/contexts/embeddings/domain/repositories/write/embedding-write.repository';
import { KnowledgeBaseContext } from '../../../src/core/tenancy/knowledge-base-context.service';

const DIMENSIONS = 1536;

/** A 1536-dim vector that is all zeros except the given index/value pairs. */
function buildVector(overrides: Record<number, number> = {}): number[] {
  const vector = new Array(DIMENSIONS).fill(0);
  for (const [index, value] of Object.entries(overrides)) {
    vector[Number(index)] = value;
  }
  return vector;
}

// Same rationale as the REST e2e spec: EMBEDDING_PORT is stubbed since there
// is no reachable OpenAI-compatible embeddings API in CI.
const QUERY_VECTOR = buildVector({ 0: 1 });

const SEARCH_QUERY = `
  query RetrievalSearch($input: RetrievalSearchGraphQLDto!) {
    retrievalSearch(input: $input) {
      chunkId
      documentId
      chunkText
      chunkPosition
      score
    }
  }
`;

describe('Retrieval GraphQL (e2e)', () => {
  let ctx: E2EContext;
  let embeddingWriteRepo: IEmbeddingWriteRepository;
  let knowledgeBaseContext: KnowledgeBaseContext;

  beforeAll(async () => {
    ctx = await createE2EApp({
      overrideProviders: [
        {
          provide: EMBEDDING_PORT,
          useValue: {
            embed: jest.fn().mockResolvedValue(QUERY_VECTOR),
            embedBatch: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    });
    embeddingWriteRepo = ctx.app.get(EMBEDDING_WRITE_REPOSITORY);
    knowledgeBaseContext = ctx.app.get(KnowledgeBaseContext);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
  });

  async function createKnowledgeBase(
    name = 'Search KB',
    embeddingModel = 'text-embedding-3-small',
  ) {
    const res = await ctx
      .http()
      .post('/api/v1/knowledge-bases')
      .send({ name, embeddingModel });
    return res.body as { id: string; apiKey: string; name: string };
  }

  function buildEmbedding(
    knowledgeBaseId: string,
    documentId: string,
    chunkId: string,
    vector: number[],
    position: number,
    text: string,
  ) {
    return new EmbeddingBuilder()
      .withId(randomUUID())
      .withKnowledgeBaseId(knowledgeBaseId)
      .withDocumentId(documentId)
      .withChunkId(chunkId)
      .withChunkText(text)
      .withChunkPosition(position)
      .withEmbedding(vector)
      .withDimensions(DIMENSIONS)
      .withModel('text-embedding-3-small')
      .withCreatedAt(new Date())
      .withUpdatedAt(new Date())
      .build();
  }

  it('retrievalSearch returns results ranked nearest-first, scoped to the caller’s knowledge base', async () => {
    const kb = await createKnowledgeBase();
    const documentId = randomUUID();
    const chunkIdFar = randomUUID();
    const chunkIdNear = randomUUID();
    const chunkIdMid = randomUUID();
    await insertDocumentFixture(ctx.dataSource, documentId, kb.id);
    await insertChunkFixture(ctx.dataSource, chunkIdFar, documentId, kb.id, 2);
    await insertChunkFixture(ctx.dataSource, chunkIdNear, documentId, kb.id, 0);
    await insertChunkFixture(ctx.dataSource, chunkIdMid, documentId, kb.id, 1);

    await knowledgeBaseContext.run(kb.id, () =>
      embeddingWriteRepo.saveMany(
        [
          buildEmbedding(
            kb.id,
            documentId,
            chunkIdFar,
            buildVector({ 0: -1 }),
            2,
            'far chunk',
          ),
          buildEmbedding(
            kb.id,
            documentId,
            chunkIdNear,
            buildVector({ 0: 1 }),
            0,
            'near chunk',
          ),
          buildEmbedding(
            kb.id,
            documentId,
            chunkIdMid,
            buildVector({ 0: 1, 1: 1 }),
            1,
            'mid chunk',
          ),
        ],
        DIMENSIONS,
      ),
    );

    const res = await ctx
      .http()
      .post('/graphql')
      .set('X-API-Key', kb.apiKey)
      .send({
        query: SEARCH_QUERY,
        variables: { input: { query: 'anything', topK: 3 } },
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    const results = res.body.data.retrievalSearch as Array<{
      chunkText: string;
      score: number;
      documentId: string;
    }>;
    expect(results.map((r) => r.chunkText)).toEqual([
      'near chunk',
      'mid chunk',
      'far chunk',
    ]);
    expect(results[0].score).toBeGreaterThan(results[1].score);
    expect(results[1].score).toBeGreaterThan(results[2].score);
    expect(results[0].documentId).toBe(documentId);
  });

  it('retrievalSearch does not leak results from another knowledge base', async () => {
    const kbOne = await createKnowledgeBase('KB One');
    const kbTwo = await createKnowledgeBase('KB Two');
    const documentIdOne = randomUUID();
    const documentIdTwo = randomUUID();
    const chunkIdOne = randomUUID();
    const chunkIdTwo = randomUUID();
    await insertDocumentFixture(ctx.dataSource, documentIdOne, kbOne.id);
    await insertDocumentFixture(ctx.dataSource, documentIdTwo, kbTwo.id);
    await insertChunkFixture(
      ctx.dataSource,
      chunkIdOne,
      documentIdOne,
      kbOne.id,
    );
    await insertChunkFixture(
      ctx.dataSource,
      chunkIdTwo,
      documentIdTwo,
      kbTwo.id,
    );

    await knowledgeBaseContext.run(kbOne.id, () =>
      embeddingWriteRepo.saveMany(
        [
          buildEmbedding(
            kbOne.id,
            documentIdOne,
            chunkIdOne,
            buildVector({ 0: 1 }),
            0,
            'kb one chunk',
          ),
        ],
        DIMENSIONS,
      ),
    );
    await knowledgeBaseContext.run(kbTwo.id, () =>
      embeddingWriteRepo.saveMany(
        [
          buildEmbedding(
            kbTwo.id,
            documentIdTwo,
            chunkIdTwo,
            buildVector({ 0: 1 }),
            0,
            'kb two chunk',
          ),
        ],
        DIMENSIONS,
      ),
    );

    const res = await ctx
      .http()
      .post('/graphql')
      .set('X-API-Key', kbOne.apiKey)
      .send({
        query: SEARCH_QUERY,
        variables: { input: { query: 'anything' } },
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.retrievalSearch).toHaveLength(1);
    expect(res.body.data.retrievalSearch[0].chunkText).toBe('kb one chunk');
  });

  it('retrievalSearch without X-API-Key returns a GraphQL error', async () => {
    const res = await gql(ctx.app, SEARCH_QUERY, {
      input: { query: 'anything' },
    });

    expect(res.body.errors).toBeDefined();
    expect(res.body.data?.retrievalSearch).toBeFalsy();
  });
});
