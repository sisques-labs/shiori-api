import { Repository } from 'typeorm';

import { createTenantRepository } from './create-tenant-repository.factory';
import { KnowledgeBaseContext } from './knowledge-base-context.service';
import { KnowledgeBaseContextMissingException } from './exceptions/knowledge-base-context-missing.exception';

interface FakeEntity {
  id: string;
  status: string;
  knowledgeBaseId: string;
}

describe('createTenantRepository', () => {
  let context: KnowledgeBaseContext;
  let rawRepo: jest.Mocked<
    Pick<
      Repository<FakeEntity>,
      'findOne' | 'find' | 'findAndCount' | 'save' | 'delete'
    >
  >;

  beforeEach(() => {
    context = new KnowledgeBaseContext();
    rawRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;
  });

  function buildRepo(): Repository<FakeEntity> {
    return createTenantRepository<FakeEntity>(rawRepo as any, context);
  }

  it('injects knowledgeBaseId into findOne/find/findAndCount where clauses', async () => {
    const repo = buildRepo();

    await context.run('kb-1', async () => {
      await repo.findOne({ where: { id: 'e-1' } });
      await repo.find({ where: { status: 'active' } });
      await repo.findAndCount({});
    });

    expect(rawRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'e-1', knowledgeBaseId: 'kb-1' },
    });
    expect(rawRepo.find).toHaveBeenCalledWith({
      where: { status: 'active', knowledgeBaseId: 'kb-1' },
    });
    expect(rawRepo.findAndCount).toHaveBeenCalledWith({
      where: { knowledgeBaseId: 'kb-1' },
    });
  });

  it('injects knowledgeBaseId into save()', async () => {
    const repo = buildRepo();

    await context.run('kb-1', async () => {
      await repo.save({ id: 'e-1' } as any);
    });

    expect(rawRepo.save).toHaveBeenCalledWith({
      id: 'e-1',
      knowledgeBaseId: 'kb-1',
    });
  });

  it('injects knowledgeBaseId into delete() for both id and criteria-object forms', async () => {
    const repo = buildRepo();

    await context.run('kb-1', async () => {
      await repo.delete('e-1');
      await repo.delete({ status: 'active' } as any);
    });

    expect(rawRepo.delete).toHaveBeenCalledWith({
      id: 'e-1',
      knowledgeBaseId: 'kb-1',
    });
    expect(rawRepo.delete).toHaveBeenCalledWith({
      status: 'active',
      knowledgeBaseId: 'kb-1',
    });
  });

  it('propagates KnowledgeBaseContextMissingException when called outside a scoped request', () => {
    const repo = buildRepo();

    expect(() => repo.findOne({})).toThrow(
      KnowledgeBaseContextMissingException,
    );
  });

  it('passes through other repository properties untouched', () => {
    const repo = createTenantRepository<FakeEntity>(
      { ...rawRepo, target: 'SomeEntity' } as any,
      context,
    );

    expect((repo as any).target).toBe('SomeEntity');
  });
});
