import { Repository } from 'typeorm';

import { NoEmbeddingTableForDimensionException } from '@contexts/embeddings/domain/exceptions/no-embedding-table-for-dimension.exception';
import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

import { EmbeddingTypeOrmMapper } from '../mappers/embedding-typeorm.mapper';
import { EmbeddingBuilder } from '@contexts/embeddings/domain/builders/embedding.builder';
import { EmbeddingTypeOrmEntity } from '../entities/embedding.entity';
import { EmbeddingTypeOrmReadRepository } from './embedding-typeorm-read.repository';

describe('EmbeddingTypeOrmReadRepository', () => {
  let mapper: EmbeddingTypeOrmMapper;
  let rawRepository: jest.Mocked<
    Pick<Repository<EmbeddingTypeOrmEntity>, 'createQueryBuilder' | 'findOne'>
  >;
  let queryBuilder: {
    innerJoin: jest.Mock;
    select: jest.Mock;
    addSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    setParameter: jest.Mock;
    limit: jest.Mock;
    getRawMany: jest.Mock;
  };
  let vectorRepository: { metadata: { tableName: string }; findOne: jest.Mock };
  let dataSource: { getRepository: jest.Mock };
  let knowledgeBaseContext: jest.Mocked<Pick<KnowledgeBaseContext, 'require'>>;
  let repository: EmbeddingTypeOrmReadRepository;

  beforeEach(() => {
    mapper = new EmbeddingTypeOrmMapper(new EmbeddingBuilder());
    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    rawRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn(),
    };
    vectorRepository = {
      metadata: { tableName: 'embedding_vectors_1536' },
      findOne: jest.fn(),
    };
    knowledgeBaseContext = { require: jest.fn().mockReturnValue('kb-1') };
    dataSource = { getRepository: jest.fn(() => vectorRepository) };

    repository = new EmbeddingTypeOrmReadRepository(
      rawRepository as any,
      mapper,
      new EmbeddingModelRegistryService(),
      dataSource as any,
      knowledgeBaseContext as any,
    );
  });

  describe('search()', () => {
    it('resolves the embedding_vectors_{dimensions} table and joins against it', async () => {
      queryBuilder.getRawMany.mockResolvedValue([
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          chunkText: 'text',
          chunkPosition: 0,
          score: 0.9,
        },
      ]);

      const results = await repository.search(
        [0.1, 0.2],
        5,
        1536,
        'text-embedding-3-small',
      );

      expect(dataSource.getRepository).toHaveBeenCalled();
      expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
        'embedding_vectors_1536',
        'vector',
        expect.any(String),
      );
      expect(queryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining('knowledge_base_id'),
        { knowledgeBaseId: 'kb-1' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('model'),
        { model: 'text-embedding-3-small' },
      );
      expect(queryBuilder.limit).toHaveBeenCalledWith(5);
      expect(results).toEqual([
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          chunkText: 'text',
          chunkPosition: 0,
          score: 0.9,
        },
      ]);
    });

    it('throws NoEmbeddingTableForDimensionException for an unregistered dimension', async () => {
      await expect(
        repository.search([0.1], 5, 999, 'text-embedding-3-small'),
      ).rejects.toBeInstanceOf(NoEmbeddingTableForDimensionException);
      expect(rawRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
