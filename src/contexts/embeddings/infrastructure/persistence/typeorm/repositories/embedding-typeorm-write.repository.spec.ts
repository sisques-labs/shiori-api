import { Repository } from 'typeorm';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { EmbeddingAggregate } from '@contexts/embeddings/domain/aggregates/embedding.aggregate';
import { EmbeddingBuilder } from '@contexts/embeddings/domain/builders/embedding.builder';
import { NoEmbeddingTableForDimensionException } from '@contexts/embeddings/domain/exceptions/no-embedding-table-for-dimension.exception';
import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

import { EmbeddingTypeOrmMapper } from '../mappers/embedding-typeorm.mapper';
import { EmbeddingTypeOrmEntity } from '../entities/embedding.entity';
import { EmbeddingTypeOrmWriteRepository } from './embedding-typeorm-write.repository';

const KNOWLEDGE_BASE_ID = UuidValueObject.generate().value;

function buildEmbedding(dimensions = 1536): EmbeddingAggregate {
  return new EmbeddingBuilder()
    .withId(UuidValueObject.generate().value)
    .withKnowledgeBaseId(KNOWLEDGE_BASE_ID)
    .withDocumentId(UuidValueObject.generate().value)
    .withChunkId(UuidValueObject.generate().value)
    .withChunkText('text')
    .withChunkPosition(0)
    .withEmbedding(new Array(dimensions).fill(0.1))
    .withDimensions(dimensions)
    .withModel('text-embedding-3-small')
    .withCreatedAt(new Date())
    .withUpdatedAt(new Date())
    .build();
}

describe('EmbeddingTypeOrmWriteRepository', () => {
  let mapper: EmbeddingTypeOrmMapper;
  let rawRepository: jest.Mocked<
    Pick<Repository<EmbeddingTypeOrmEntity>, 'delete' | 'findOne'>
  >;
  let vectorRepository: { save: jest.Mock; findOne: jest.Mock };
  let managerVectorRepository: { save: jest.Mock };
  let managerMetadataRepository: { save: jest.Mock };
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let knowledgeBaseContext: jest.Mocked<Pick<KnowledgeBaseContext, 'require'>>;
  let repository: EmbeddingTypeOrmWriteRepository;

  beforeEach(() => {
    mapper = new EmbeddingTypeOrmMapper(new EmbeddingBuilder());
    rawRepository = { delete: jest.fn(), findOne: jest.fn() };
    vectorRepository = { save: jest.fn(), findOne: jest.fn() };
    managerVectorRepository = { save: jest.fn() };
    managerMetadataRepository = { save: jest.fn() };
    knowledgeBaseContext = { require: jest.fn().mockReturnValue('kb-1') };

    dataSource = {
      transaction: jest.fn(async (fn: any) =>
        fn({
          getRepository: jest.fn((entityClass: any) =>
            entityClass === EmbeddingTypeOrmEntity
              ? managerMetadataRepository
              : managerVectorRepository,
          ),
        }),
      ),
      getRepository: jest.fn(() => vectorRepository),
    };

    repository = new EmbeddingTypeOrmWriteRepository(
      mapper,
      new EmbeddingModelRegistryService(),
      rawRepository as any,
      dataSource as any,
      knowledgeBaseContext as any,
    );
  });

  describe('saveMany()', () => {
    it('is a no-op for an empty array', async () => {
      await repository.saveMany([], 1536);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('writes both the metadata row and the matching vector row inside one transaction', async () => {
      const embedding = buildEmbedding(1536);

      await repository.saveMany([embedding], 1536);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(managerMetadataRepository.save).toHaveBeenCalledTimes(1);
      expect(managerVectorRepository.save).toHaveBeenCalledTimes(1);

      const [savedMetadata] = managerMetadataRepository.save.mock
        .calls[0][0] as EmbeddingTypeOrmEntity[];
      expect(savedMetadata.id).toBe(embedding.id.value);
      expect(savedMetadata.knowledgeBaseId).toBe('kb-1');
      expect((savedMetadata as any).embedding).toBeUndefined();

      const [savedVector] = managerVectorRepository.save.mock.calls[0][0] as [
        { embeddingId: string; embedding: number[] },
      ];
      expect(savedVector.embeddingId).toBe(embedding.id.value);
      expect(savedVector.embedding).toHaveLength(1536);
    });

    it('throws NoEmbeddingTableForDimensionException for an unregistered dimension', async () => {
      const embedding = buildEmbedding(999);

      await expect(
        repository.saveMany([embedding], 999),
      ).rejects.toBeInstanceOf(NoEmbeddingTableForDimensionException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('deleteByDocumentId()', () => {
    it('deletes from the metadata table by documentId only, no dimension ever passed', async () => {
      await repository.deleteByDocumentId('doc-1');

      // Goes through the tenant-repo proxy, which merges in the ambient
      // knowledgeBaseId — the call reaching the raw repository never
      // includes a `dimensions` filter, since the vector row is removed by
      // the DB's own ON DELETE CASCADE.
      expect(rawRepository.delete).toHaveBeenCalledWith({
        documentId: 'doc-1',
        knowledgeBaseId: 'kb-1',
      });
    });
  });

  describe('deleteByKnowledgeBaseId()', () => {
    it('deletes by knowledgeBaseId directly on the raw repository', async () => {
      await repository.deleteByKnowledgeBaseId('kb-1');

      expect(rawRepository.delete).toHaveBeenCalledWith({
        knowledgeBaseId: 'kb-1',
      });
    });
  });

  describe('deleteByKnowledgeBaseIdAndModel()', () => {
    it('filters by both knowledgeBaseId and model, never a dimension', async () => {
      await repository.deleteByKnowledgeBaseIdAndModel(
        'kb-1',
        'text-embedding-3-small',
      );

      expect(rawRepository.delete).toHaveBeenCalledWith({
        knowledgeBaseId: 'kb-1',
        model: 'text-embedding-3-small',
      });
    });
  });
});
