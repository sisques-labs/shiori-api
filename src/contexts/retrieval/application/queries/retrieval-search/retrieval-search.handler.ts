import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  EMBEDDING_SEARCH_PORT,
  IEmbeddingSearchPort,
  IRetrievalSearchResult,
} from '@contexts/retrieval/application/ports/embedding-search.port';
import { RetrievalConfig } from '@contexts/retrieval/infrastructure/config/retrieval.config';

import { RetrievalSearchQuery } from './retrieval-search.query';

@QueryHandler(RetrievalSearchQuery)
export class RetrievalSearchQueryHandler implements IQueryHandler<
  RetrievalSearchQuery,
  IRetrievalSearchResult[]
> {
  private readonly logger = new Logger(RetrievalSearchQueryHandler.name);
  private readonly searchTopKDefault: number;
  private readonly searchTopKMax: number;

  constructor(
    @Inject(EMBEDDING_SEARCH_PORT)
    private readonly embeddingSearchPort: IEmbeddingSearchPort,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<RetrievalConfig>('retrieval');
    this.searchTopKDefault = config.searchTopKDefault;
    this.searchTopKMax = config.searchTopKMax;
  }

  async execute(
    query: RetrievalSearchQuery,
  ): Promise<IRetrievalSearchResult[]> {
    const topK = Math.min(
      query.topK ?? this.searchTopKDefault,
      this.searchTopKMax,
    );

    this.logger.log(`Searching: topK=${topK}`);

    return this.embeddingSearchPort.search(query.query, topK);
  }
}
