import { Repository } from 'typeorm';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseBuilder } from '@contexts/knowledge-bases/domain/builders/knowledge-base.builder';

import { KnowledgeBaseTypeOrmEntity } from '../entities/knowledge-base.entity';
import { KnowledgeBaseTypeOrmMapper } from '../mappers/knowledge-base-typeorm.mapper';
import { KnowledgeBaseTypeOrmWriteRepository } from './knowledge-base-typeorm-write.repository';

describe('KnowledgeBaseTypeOrmWriteRepository', () => {
  let rawRepo: jest.Mocked<
    Pick<Repository<KnowledgeBaseTypeOrmEntity>, 'findOne' | 'save' | 'delete'>
  >;
  let mapper: KnowledgeBaseTypeOrmMapper;
  let repository: KnowledgeBaseTypeOrmWriteRepository;

  beforeEach(() => {
    rawRepo = { findOne: jest.fn(), save: jest.fn(), delete: jest.fn() } as any;
    mapper = new KnowledgeBaseTypeOrmMapper(new KnowledgeBaseBuilder());
    repository = new KnowledgeBaseTypeOrmWriteRepository(
      mapper,
      rawRepo as any,
    );
  });

  function buildAggregate(): KnowledgeBaseAggregate {
    return new KnowledgeBaseBuilder()
      .withId('e3c1a1b0-0000-4000-8000-000000000001')
      .withName('Docs')
      .withApiKeyHash('a'.repeat(64))
      .withCreatedAt(new Date())
      .withUpdatedAt(new Date())
      .build();
  }

  it('save() persists via the mapper', async () => {
    const aggregate = buildAggregate();
    rawRepo.save.mockResolvedValue(mapper.toPersistence(aggregate));

    await repository.save(aggregate);

    expect(rawRepo.save).toHaveBeenCalledWith(mapper.toPersistence(aggregate));
  });

  it('findById() returns null when no entity is found', async () => {
    rawRepo.findOne.mockResolvedValue(null);

    await expect(repository.findById('missing')).resolves.toBeNull();
  });

  it('findById() maps a found entity to an aggregate', async () => {
    const aggregate = buildAggregate();
    rawRepo.findOne.mockResolvedValue(mapper.toPersistence(aggregate));

    const result = await repository.findById(aggregate.id.value);

    expect(result?.id.value).toBe(aggregate.id.value);
  });

  it('delete() delegates to the underlying repository', async () => {
    await repository.delete('kb-1');

    expect(rawRepo.delete).toHaveBeenCalledWith('kb-1');
  });

  it('findByCriteria() is not implemented (no transport surface)', async () => {
    await expect(repository.findByCriteria({} as any)).rejects.toThrow(
      'Method not implemented.',
    );
  });
});
