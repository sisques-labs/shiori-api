import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  EMBEDDING_PORT,
  IEmbeddingPort,
} from '@contexts/embeddings/application/ports/embedding.port';
import {
  KNOWLEDGE_BASE_EMBEDDING_CONFIG_PORT,
  IKnowledgeBaseEmbeddingConfigPort,
} from '@contexts/embeddings/application/ports/knowledge-base-embedding-config.port';
import { AssertEmbeddingSearchReadyService } from '@contexts/embeddings/application/services/read/assert-embedding-search-ready/assert-embedding-search-ready.service';
import {
  EMBEDDING_READ_REPOSITORY,
  IEmbeddingReadRepository,
  IEmbeddingSearchResult,
} from '@contexts/embeddings/domain/repositories/read/embedding-read.repository';
import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

import { EmbeddingSearchQuery } from './embedding-search.query';

@QueryHandler(EmbeddingSearchQuery)
export class EmbeddingSearchQueryHandler implements IQueryHandler<
  EmbeddingSearchQuery,
  IEmbeddingSearchResult[]
> {
  private readonly logger = new Logger(EmbeddingSearchQueryHandler.name);

  constructor(
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: IEmbeddingPort,
    @Inject(EMBEDDING_READ_REPOSITORY)
    private readonly readRepository: IEmbeddingReadRepository,
    @Inject(KNOWLEDGE_BASE_EMBEDDING_CONFIG_PORT)
    private readonly knowledgeBaseEmbeddingConfig: IKnowledgeBaseEmbeddingConfigPort,
    private readonly assertSearchReady: AssertEmbeddingSearchReadyService,
    private readonly modelRegistry: EmbeddingModelRegistryService,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {}

  async execute(
    query: EmbeddingSearchQuery,
  ): Promise<IEmbeddingSearchResult[]> {
    const knowledgeBaseId = this.knowledgeBaseContext.require();

    this.logger.log(`Searching: topK=${query.topK}`);

    const config =
      await this.knowledgeBaseEmbeddingConfig.getByKnowledgeBaseId(
        knowledgeBaseId,
      );

    this.assertSearchReady.execute(knowledgeBaseId, config.embeddingStatus);

    const { dimensions } = this.modelRegistry.getOrThrow(config.embeddingModel);

    const vector = await this.embeddingPort.embed(
      query.text,
      config.embeddingModel,
    );
    return this.readRepository.search(
      vector,
      query.topK,
      dimensions,
      config.embeddingModel,
    );
  }
}
