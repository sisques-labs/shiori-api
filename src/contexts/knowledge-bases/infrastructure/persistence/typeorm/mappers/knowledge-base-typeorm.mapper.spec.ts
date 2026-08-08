import { KnowledgeBaseBuilder } from '@contexts/knowledge-bases/domain/builders/knowledge-base.builder';

import { KnowledgeBaseTypeOrmEntity } from '../entities/knowledge-base.entity';
import { KnowledgeBaseTypeOrmMapper } from './knowledge-base-typeorm.mapper';

describe('KnowledgeBaseTypeOrmMapper', () => {
  let mapper: KnowledgeBaseTypeOrmMapper;

  beforeEach(() => {
    mapper = new KnowledgeBaseTypeOrmMapper(new KnowledgeBaseBuilder());
  });

  function buildEntity(): KnowledgeBaseTypeOrmEntity {
    const entity = new KnowledgeBaseTypeOrmEntity();
    entity.id = 'e3c1a1b0-0000-4000-8000-000000000001';
    entity.name = 'Docs';
    entity.description = 'Internal docs';
    entity.apiKeyHash = 'a'.repeat(64);
    entity.embeddingModel = 'text-embedding-3-small';
    entity.embeddingStatus = 'READY';
    entity.createdAt = new Date();
    entity.updatedAt = new Date();
    return entity;
  }

  it('maps entity to aggregate', () => {
    const entity = buildEntity();
    const aggregate = mapper.toDomain(entity);

    expect(aggregate.id.value).toBe(entity.id);
    expect(aggregate.name.value).toBe(entity.name);
    expect(aggregate.description?.value).toBe(entity.description);
    expect(aggregate.apiKeyHash.value).toBe(entity.apiKeyHash);
    expect(aggregate.embeddingModel.value).toBe(entity.embeddingModel);
    expect(aggregate.embeddingStatus.value).toBe(entity.embeddingStatus);
  });

  it('maps aggregate to persistence entity', () => {
    const entity = buildEntity();
    const aggregate = mapper.toDomain(entity);

    const persisted = mapper.toPersistence(aggregate);

    expect(persisted.id).toBe(entity.id);
    expect(persisted.name).toBe(entity.name);
    expect(persisted.description).toBe(entity.description);
    expect(persisted.apiKeyHash).toBe(entity.apiKeyHash);
    expect(persisted.embeddingModel).toBe(entity.embeddingModel);
    expect(persisted.embeddingStatus).toBe(entity.embeddingStatus);
  });

  it('maps entity to view model', () => {
    const entity = buildEntity();
    const viewModel = mapper.toViewModel(entity);

    expect(viewModel.id).toBe(entity.id);
    expect(viewModel.name).toBe(entity.name);
    expect(viewModel.apiKeyHash).toBe(entity.apiKeyHash);
    expect(viewModel.embeddingModel).toBe(entity.embeddingModel);
    expect(viewModel.embeddingStatus).toBe(entity.embeddingStatus);
  });
});
