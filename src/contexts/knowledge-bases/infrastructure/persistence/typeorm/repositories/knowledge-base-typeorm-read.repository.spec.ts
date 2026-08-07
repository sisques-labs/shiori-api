import { Repository } from 'typeorm';

import { KnowledgeBaseBuilder } from '@contexts/knowledge-bases/domain/builders/knowledge-base.builder';

import { KnowledgeBaseTypeOrmEntity } from '../entities/knowledge-base.entity';
import { KnowledgeBaseTypeOrmMapper } from '../mappers/knowledge-base-typeorm.mapper';
import { KnowledgeBaseTypeOrmReadRepository } from './knowledge-base-typeorm-read.repository';

describe('KnowledgeBaseTypeOrmReadRepository', () => {
  let rawRepo: jest.Mocked<
    Pick<Repository<KnowledgeBaseTypeOrmEntity>, 'findOne'>
  >;
  let mapper: KnowledgeBaseTypeOrmMapper;
  let repository: KnowledgeBaseTypeOrmReadRepository;

  function buildEntity(): KnowledgeBaseTypeOrmEntity {
    const entity = new KnowledgeBaseTypeOrmEntity();
    entity.id = 'e3c1a1b0-0000-4000-8000-000000000001';
    entity.name = 'Docs';
    entity.description = null;
    entity.apiKeyHash = 'a'.repeat(64);
    entity.createdAt = new Date();
    entity.updatedAt = new Date();
    return entity;
  }

  beforeEach(() => {
    rawRepo = { findOne: jest.fn() } as any;
    mapper = new KnowledgeBaseTypeOrmMapper(new KnowledgeBaseBuilder());
    repository = new KnowledgeBaseTypeOrmReadRepository(rawRepo as any, mapper);
  });

  it('findById() returns the view model when found', async () => {
    const entity = buildEntity();
    rawRepo.findOne.mockResolvedValue(entity);

    const viewModel = await repository.findById(entity.id);

    expect(viewModel?.id).toBe(entity.id);
  });

  it('findByApiKeyHash() queries by the hash column', async () => {
    const entity = buildEntity();
    rawRepo.findOne.mockResolvedValue(entity);

    const viewModel = await repository.findByApiKeyHash(entity.apiKeyHash);

    expect(rawRepo.findOne).toHaveBeenCalledWith({
      where: { apiKeyHash: entity.apiKeyHash },
    });
    expect(viewModel?.apiKeyHash).toBe(entity.apiKeyHash);
  });

  it('findByApiKeyHash() returns null for an unknown hash', async () => {
    rawRepo.findOne.mockResolvedValue(null);

    await expect(
      repository.findByApiKeyHash('b'.repeat(64)),
    ).resolves.toBeNull();
  });

  it('findByCriteria() is not implemented (no transport surface)', async () => {
    await expect(repository.findByCriteria({} as any)).rejects.toThrow(
      'Method not implemented.',
    );
  });
});
