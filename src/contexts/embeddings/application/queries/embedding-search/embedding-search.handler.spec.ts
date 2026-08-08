import { IEmbeddingPort } from '@contexts/embeddings/application/ports/embedding.port';
import { IKnowledgeBaseEmbeddingConfigPort } from '@contexts/embeddings/application/ports/knowledge-base-embedding-config.port';
import { AssertEmbeddingSearchReadyService } from '@contexts/embeddings/application/services/read/assert-embedding-search-ready/assert-embedding-search-ready.service';
import { EmbeddingSearchNotReadyException } from '@contexts/embeddings/domain/exceptions/embedding-search-not-ready.exception';
import {
  IEmbeddingReadRepository,
  IEmbeddingSearchResult,
} from '@contexts/embeddings/domain/repositories/read/embedding-read.repository';
import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

import { EmbeddingSearchQuery } from './embedding-search.query';
import { EmbeddingSearchQueryHandler } from './embedding-search.handler';

function buildHandler(knowledgeBaseId = 'kb-1') {
  const embeddingPort: jest.Mocked<IEmbeddingPort> = {
    embed: jest.fn(),
    embedBatch: jest.fn(),
  };
  const readRepository: jest.Mocked<IEmbeddingReadRepository> = {
    search: jest.fn(),
    findById: jest.fn(),
    findByCriteria: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const knowledgeBaseEmbeddingConfig: jest.Mocked<IKnowledgeBaseEmbeddingConfigPort> =
    {
      getByKnowledgeBaseId: jest.fn(),
    };
  const knowledgeBaseContext = {
    require: jest.fn().mockReturnValue(knowledgeBaseId),
  } as unknown as jest.Mocked<KnowledgeBaseContext>;

  const handler = new EmbeddingSearchQueryHandler(
    embeddingPort,
    readRepository,
    knowledgeBaseEmbeddingConfig,
    new AssertEmbeddingSearchReadyService(),
    new EmbeddingModelRegistryService(),
    knowledgeBaseContext,
  );

  return {
    handler,
    embeddingPort,
    readRepository,
    knowledgeBaseEmbeddingConfig,
    knowledgeBaseContext,
  };
}

const RESULT: IEmbeddingSearchResult = {
  chunkId: 'chunk-1',
  documentId: 'doc-1',
  chunkText: 'text',
  chunkPosition: 0,
  score: 0.9,
};

describe('EmbeddingSearchQueryHandler', () => {
  it('embeds the text and delegates to the read repository with the resolved model/dimensions', async () => {
    const {
      handler,
      embeddingPort,
      readRepository,
      knowledgeBaseEmbeddingConfig,
    } = buildHandler();
    knowledgeBaseEmbeddingConfig.getByKnowledgeBaseId.mockResolvedValue({
      embeddingModel: 'text-embedding-3-small',
      embeddingStatus: 'READY',
    });
    embeddingPort.embed.mockResolvedValue([0.1, 0.2, 0.3]);
    readRepository.search.mockResolvedValue([RESULT]);

    const result = await handler.execute(
      new EmbeddingSearchQuery({ text: 'hello', topK: 5 }),
    );

    expect(embeddingPort.embed).toHaveBeenCalledWith(
      'hello',
      'text-embedding-3-small',
    );
    expect(readRepository.search).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      5,
      1536,
    );
    expect(result).toEqual([RESULT]);
  });

  it('throws EmbeddingSearchNotReadyException when status !== READY', async () => {
    const {
      handler,
      embeddingPort,
      readRepository,
      knowledgeBaseEmbeddingConfig,
    } = buildHandler();
    knowledgeBaseEmbeddingConfig.getByKnowledgeBaseId.mockResolvedValue({
      embeddingModel: 'text-embedding-3-small',
      embeddingStatus: 'REEMBEDDING',
    });

    await expect(
      handler.execute(new EmbeddingSearchQuery({ text: 'hello', topK: 5 })),
    ).rejects.toBeInstanceOf(EmbeddingSearchNotReadyException);

    expect(embeddingPort.embed).not.toHaveBeenCalled();
    expect(readRepository.search).not.toHaveBeenCalled();
  });
});
