import { createE2EApp, E2EContext } from '../../helpers/app-bootstrap';
import { truncateAll } from '../../helpers/db-reset';
import { gql } from '../../helpers/graphql-client';

describe('Documents GraphQL (e2e)', () => {
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
    mutation CreateDocument($input: CreateDocumentGraphQLDto!) {
      createDocument(input: $input) {
        success
        message
        id
      }
    }
  `;

  const FIND_BY_CRITERIA_QUERY = `
    query DocumentFindByCriteria($input: DocumentFindByCriteriaRequestDto) {
      documentFindByCriteria(input: $input) {
        items {
          id
          title
          status
        }
        total
        page
        perPage
        totalPages
      }
    }
  `;

  async function createKnowledgeBase(name = 'Docs KB') {
    const res = await ctx.http().post('/api/v1/knowledge-bases').send({ name });
    return res.body as { id: string; apiKey: string; name: string };
  }

  async function createDocument(
    apiKey: string,
    input: { title: string; content: string },
  ) {
    return ctx
      .http()
      .post('/graphql')
      .set('X-API-Key', apiKey)
      .send({ query: CREATE_MUTATION, variables: { input } });
  }

  it('createDocument mutation queues chunking and returns the new id', async () => {
    const kb = await createKnowledgeBase();

    const res = await createDocument(kb.apiKey, {
      title: 'My Doc',
      content: 'Some content',
    });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.createDocument.success).toBe(true);
    expect(res.body.data.createDocument.id).toBeDefined();
  });

  it('createDocument mutation without X-API-Key returns a GraphQL error', async () => {
    const res = await gql(ctx.app, CREATE_MUTATION, {
      input: { title: 'My Doc', content: 'Some content' },
    });

    expect(res.body.errors).toBeDefined();
    expect(res.body.data?.createDocument).toBeFalsy();
  });

  it('documentFindByCriteria paginates results scoped to the caller’s knowledge base', async () => {
    const kb = await createKnowledgeBase();

    for (let i = 0; i < 3; i++) {
      await createDocument(kb.apiKey, {
        title: `Doc ${i}`,
        content: 'Some content',
      });
    }

    const res = await ctx
      .http()
      .post('/graphql')
      .set('X-API-Key', kb.apiKey)
      .send({
        query: FIND_BY_CRITERIA_QUERY,
        variables: { input: { pagination: { page: 1, perPage: 2 } } },
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.documentFindByCriteria.items).toHaveLength(2);
    expect(res.body.data.documentFindByCriteria.total).toBe(3);
    expect(res.body.data.documentFindByCriteria.page).toBe(1);
    expect(res.body.data.documentFindByCriteria.perPage).toBe(2);
    expect(res.body.data.documentFindByCriteria.totalPages).toBe(2);
  });

  it('documentFindByCriteria does not leak documents from another knowledge base', async () => {
    const kbOne = await createKnowledgeBase('KB One');
    const kbTwo = await createKnowledgeBase('KB Two');

    await createDocument(kbOne.apiKey, {
      title: 'KB One Doc',
      content: 'c',
    });
    await createDocument(kbTwo.apiKey, {
      title: 'KB Two Doc',
      content: 'c',
    });

    const res = await ctx
      .http()
      .post('/graphql')
      .set('X-API-Key', kbOne.apiKey)
      .send({ query: FIND_BY_CRITERIA_QUERY, variables: { input: {} } });

    expect(res.status).toBe(200);
    expect(res.body.data.documentFindByCriteria.items).toHaveLength(1);
    expect(res.body.data.documentFindByCriteria.items[0].title).toBe(
      'KB One Doc',
    );
  });
});
