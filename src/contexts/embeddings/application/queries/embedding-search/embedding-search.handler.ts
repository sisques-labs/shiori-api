import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  EMBEDDING_PORT,
  IEmbeddingPort,
} from '@contexts/embeddings/application/ports/embedding.port';
import {
  EMBEDDING_READ_REPOSITORY,
  IEmbeddingReadRepository,
  IEmbeddingSearchResult,
} from '@contexts/embeddings/domain/repositories/read/embedding-read.repository';

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
  ) {}

  async execute(
    query: EmbeddingSearchQuery,
  ): Promise<IEmbeddingSearchResult[]> {
    this.logger.log(`Searching: topK=${query.topK}`);

    const vector = await this.embeddingPort.embed(query.text);
    return this.readRepository.search(vector, query.topK);
  }
}
