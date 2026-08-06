import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  EMBEDDING_PORT,
  IEmbeddingPort,
} from '@contexts/retrieval/application/ports/embedding.port';
import {
  EMBEDDING_READ_REPOSITORY,
  IEmbeddingReadRepository,
  IRetrievalSearchResult,
} from '@contexts/retrieval/domain/repositories/read/embedding-read.repository';
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
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: IEmbeddingPort,
    @Inject(EMBEDDING_READ_REPOSITORY)
    private readonly readRepository: IEmbeddingReadRepository,
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

    const vector = await this.embeddingPort.embed(query.query);
    return this.readRepository.search(vector, topK);
  }
}
