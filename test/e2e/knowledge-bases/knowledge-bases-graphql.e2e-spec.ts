import { createE2EApp, E2EContext } from '../../helpers/app-bootstrap';
import { truncateAll } from '../../helpers/db-reset';
import { gql } from '../../helpers/graphql-client';

describe('KnowledgeBases GraphQL (e2e)', () => {
  let ctx: E2EContext;

  beforeAll(async () => {
    ctx = await createE2EApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
  });

  const CREATE_MUTATION = `
    mutation CreateKnowledgeBase($input: CreateKnowledgeBaseGraphQLDto!) {
      createKnowledgeBase(input: $input) {
        id
        name
        apiKey
      }
    }
  `;

  const KNOWLEDGE_BASE_QUERY = `
    query {
      knowledgeBase {
        id
        name
        description
      }
    }
  `;

  async function createKnowledgeBase(
    name = 'Docs',
    embeddingModel = 'text-embedding-3-small',
  ) {
    const res = await gql(ctx.app, CREATE_MUTATION, {
      input: { name, embeddingModel },
    });
    return res.body.data.createKnowledgeBase as {
      id: string;
      name: string;
      apiKey: string;
    };
  }

  it('SC-01: createKnowledgeBase returns the plaintext apiKey', async () => {
    const res = await gql(ctx.app, CREATE_MUTATION, {
      input: { name: 'Docs', embeddingModel: 'text-embedding-3-small' },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.createKnowledgeBase.apiKey).toMatch(/^kb_/);
    expect(res.body.data.createKnowledgeBase.name).toBe('Docs');
  });

  it('SC-07: knowledgeBase query without X-API-Key returns a GraphQL error', async () => {
    const res = await gql(ctx.app, KNOWLEDGE_BASE_QUERY);

    expect(res.body.errors).toBeDefined();
    expect(res.body.data?.knowledgeBase).toBeFalsy();
  });

  it('SC-08/SC-09: knowledgeBase query resolves only the caller’s own knowledge base, with no id argument', async () => {
    const created = await createKnowledgeBase();

    const res = await ctx
      .http()
      .post('/graphql')
      .set('X-API-Key', created.apiKey)
      .send({ query: KNOWLEDGE_BASE_QUERY });

    expect(res.status).toBe(200);
    expect(res.body.data.knowledgeBase.id).toBe(created.id);
  });
});
