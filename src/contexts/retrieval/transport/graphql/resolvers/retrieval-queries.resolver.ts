import { Logger, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, Query, Resolver } from '@nestjs/graphql';

import { RetrievalSearchQuery } from '@contexts/retrieval/application/queries/retrieval-search/retrieval-search.query';
import { IRetrievalSearchResult } from '@contexts/retrieval/application/ports/embedding-search.port';
import { KnowledgeBaseApiKeyGuard } from '@core/tenancy/knowledge-base-api-key.guard';

import { RetrievalSearchGraphQLDto } from '../dtos/requests/retrieval-search-graphql.dto';
import { RetrievalSearchResultResponseDto } from '../dtos/responses/retrieval-search-result.response.dto';
import { RetrievalGraphQLMapper } from '../mappers/retrieval/retrieval.mapper';

@UseGuards(KnowledgeBaseApiKeyGuard)
@Resolver(() => RetrievalSearchResultResponseDto)
export class RetrievalQueriesResolver {
  private readonly logger = new Logger(RetrievalQueriesResolver.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly graphQLMapper: RetrievalGraphQLMapper,
  ) {}

  @Query(() => [RetrievalSearchResultResponseDto])
  async retrievalSearch(
    @Args('input') input: RetrievalSearchGraphQLDto,
  ): Promise<RetrievalSearchResultResponseDto[]> {
    this.logger.log(`Searching: "${input.query}"`);

    const results = await this.queryBus.execute<
      RetrievalSearchQuery,
      IRetrievalSearchResult[]
    >(new RetrievalSearchQuery({ query: input.query, topK: input.topK }));

    return results.map((result) => this.graphQLMapper.toResponseDto(result));
  }
}
