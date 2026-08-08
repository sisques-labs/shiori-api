import { createE2EApp, E2EContext } from '../../helpers/app-bootstrap';
import { truncateAll } from '../../helpers/db-reset';

describe('KnowledgeBases REST (e2e)', () => {
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

  async function createKnowledgeBase(
    name = 'Docs',
    embeddingModel = 'text-embedding-3-small',
  ) {
    const res = await ctx
      .http()
      .post('/api/v1/knowledge-bases')
      .send({ name, embeddingModel });
    return res.body as { id: string; apiKey: string; name: string };
  }

  it('SC-01: POST / creates a knowledge base and returns the plaintext apiKey once', async () => {
    const res = await ctx
      .http()
      .post('/api/v1/knowledge-bases')
      .send({ name: 'Docs', embeddingModel: 'text-embedding-3-small' });

    expect(res.status).toBe(201);
    expect(res.body.apiKey).toMatch(/^kb_/);
    expect(res.body.name).toBe('Docs');
    expect(res.body.apiKeyHash).toBeUndefined();
  });

  it('SC-04: POST / requires no X-API-Key header', async () => {
    const res = await ctx
      .http()
      .post('/api/v1/knowledge-bases')
      .send({ name: 'Docs', embeddingModel: 'text-embedding-3-small' });

    expect(res.status).toBe(201);
  });

  it('SC-07: GET /me without a header returns 401', async () => {
    const res = await ctx.http().get('/api/v1/knowledge-bases/me');

    expect(res.status).toBe(401);
  });

  it('SC-06: GET /me with an unknown key returns 401', async () => {
    const res = await ctx
      .http()
      .get('/api/v1/knowledge-bases/me')
      .set('X-API-Key', 'kb_unknown-key-value');

    expect(res.status).toBe(401);
  });

  it('SC-08: GET /me with a valid key returns the caller’s own knowledge base, no apiKeyHash', async () => {
    const created = await createKnowledgeBase();

    const res = await ctx
      .http()
      .get('/api/v1/knowledge-bases/me')
      .set('X-API-Key', created.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
    expect(res.body.apiKeyHash).toBeUndefined();
    expect(res.body.apiKey).toBeUndefined();
  });

  it('SC-02: PATCH /me updates the caller’s own knowledge base', async () => {
    const created = await createKnowledgeBase();

    const res = await ctx
      .http()
      .patch('/api/v1/knowledge-bases/me')
      .set('X-API-Key', created.apiKey)
      .send({ name: 'Docs v2' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Docs v2');
  });

  it('SC-03: DELETE /me then GET /me with the same key returns 401', async () => {
    const created = await createKnowledgeBase();

    const deleteRes = await ctx
      .http()
      .delete('/api/v1/knowledge-bases/me')
      .set('X-API-Key', created.apiKey);
    expect(deleteRes.status).toBe(204);

    const getRes = await ctx
      .http()
      .get('/api/v1/knowledge-bases/me')
      .set('X-API-Key', created.apiKey);
    expect(getRes.status).toBe(401);
  });

  it('SC-10: rotate-api-key invalidates the previous key immediately', async () => {
    const created = await createKnowledgeBase();

    const rotateRes = await ctx
      .http()
      .post('/api/v1/knowledge-bases/me/rotate-api-key')
      .set('X-API-Key', created.apiKey);
    expect(rotateRes.status).toBe(200);
    const newKey = rotateRes.body.apiKey as string;
    expect(newKey).toMatch(/^kb_/);
    expect(newKey).not.toBe(created.apiKey);

    const oldKeyRes = await ctx
      .http()
      .get('/api/v1/knowledge-bases/me')
      .set('X-API-Key', created.apiKey);
    expect(oldKeyRes.status).toBe(401);

    const newKeyRes = await ctx
      .http()
      .get('/api/v1/knowledge-bases/me')
      .set('X-API-Key', newKey);
    expect(newKeyRes.status).toBe(200);
  });
});
