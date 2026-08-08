import { createE2EApp, E2EContext } from '../../helpers/app-bootstrap';
import { truncateAll } from '../../helpers/db-reset';

describe('Documents REST (e2e)', () => {
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

  async function createKnowledgeBase(name = 'Docs KB') {
    const res = await ctx.http().post('/api/v1/knowledge-bases').send({ name });
    return res.body as { id: string; apiKey: string; name: string };
  }

  async function createDocument(
    apiKey: string,
    body: { title: string; content: string },
  ) {
    return ctx
      .http()
      .post('/api/v1/documents')
      .set('X-API-Key', apiKey)
      .send(body);
  }

  it('POST /api/v1/documents creates a document and returns 202 with PENDING status', async () => {
    const kb = await createKnowledgeBase();

    const res = await createDocument(kb.apiKey, {
      title: 'My Doc',
      content: 'Some content',
    });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.id).toBeDefined();
  });

  it('POST /api/v1/documents without an API key returns 401', async () => {
    const res = await ctx
      .http()
      .post('/api/v1/documents')
      .send({ title: 'My Doc', content: 'Some content' });

    expect(res.status).toBe(401);
  });

  it('GET /api/v1/documents/:id returns the created document', async () => {
    const kb = await createKnowledgeBase();
    const created = await createDocument(kb.apiKey, {
      title: 'My Doc',
      content: 'Some content',
    });

    const res = await ctx
      .http()
      .get(`/api/v1/documents/${created.body.id}`)
      .set('X-API-Key', kb.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.title).toBe('My Doc');
    expect(res.body.content).toBe('Some content');
  });

  it('GET /api/v1/documents/:id for an unknown id returns 404', async () => {
    const kb = await createKnowledgeBase();

    const res = await ctx
      .http()
      .get('/api/v1/documents/00000000-0000-4000-8000-000000000000')
      .set('X-API-Key', kb.apiKey);

    expect(res.status).toBe(404);
  });

  it('POST /api/v1/documents with oversized content returns 413', async () => {
    const kb = await createKnowledgeBase();
    // DOCUMENTS_MAX_CONTENT_LENGTH defaults to 500000 when unset.
    const maxContentLength = parseInt(
      process.env.DOCUMENTS_MAX_CONTENT_LENGTH ?? '500000',
      10,
    );
    const oversizedContent = 'x'.repeat(maxContentLength + 1);

    const res = await createDocument(kb.apiKey, {
      title: 'Too big',
      content: oversizedContent,
    });

    expect(res.status).toBe(413);
  });

  it('GET /api/v1/documents lists documents scoped to the caller’s knowledge base', async () => {
    const kbOne = await createKnowledgeBase('KB One');
    const kbTwo = await createKnowledgeBase('KB Two');

    await createDocument(kbOne.apiKey, { title: 'KB One Doc', content: 'c' });
    await createDocument(kbTwo.apiKey, { title: 'KB Two Doc', content: 'c' });

    const res = await ctx
      .http()
      .get('/api/v1/documents')
      .set('X-API-Key', kbOne.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('KB One Doc');
  });

  it('DELETE /api/v1/documents/:id removes the document; a re-fetch returns 404', async () => {
    const kb = await createKnowledgeBase();
    const created = await createDocument(kb.apiKey, {
      title: 'To delete',
      content: 'Some content',
    });

    const deleteRes = await ctx
      .http()
      .delete(`/api/v1/documents/${created.body.id}`)
      .set('X-API-Key', kb.apiKey);
    expect(deleteRes.status).toBe(204);

    const getRes = await ctx
      .http()
      .get(`/api/v1/documents/${created.body.id}`)
      .set('X-API-Key', kb.apiKey);
    expect(getRes.status).toBe(404);

    const chunksCount = await ctx.dataSource.query(
      'SELECT COUNT(*)::int AS count FROM chunks WHERE document_id = $1',
      [created.body.id],
    );
    expect(chunksCount[0].count).toBe(0);
  });
});
