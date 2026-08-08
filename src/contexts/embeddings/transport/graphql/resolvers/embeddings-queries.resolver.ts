import { Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Query, Resolver } from '@nestjs/graphql';

import { EmbeddingAvailableModelsQuery } from '@contexts/embeddings/application/queries/embedding-available-models/embedding-available-models.query';
import { EmbeddingModelDefinition } from '@contexts/embeddings/domain/constants/embedding-models-registry.constant';

import { EmbeddingModelResponseDto } from '../dtos/responses/embedding-model.response.dto';
import { EmbeddingModelGraphQLMapper } from '../mappers/embedding-model/embedding-model.mapper';

@Resolver(() => EmbeddingModelResponseDto)
export class EmbeddingsQueriesResolver {
  private readonly logger = new Logger(EmbeddingsQueriesResolver.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly graphQLMapper: EmbeddingModelGraphQLMapper,
  ) {}

  @Query(() => [EmbeddingModelResponseDto])
  async embeddingModels(): Promise<EmbeddingModelResponseDto[]> {
    this.logger.log('Listing available embedding models');

    const models = await this.queryBus.execute<
      EmbeddingAvailableModelsQuery,
      readonly EmbeddingModelDefinition[]
    >(new EmbeddingAvailableModelsQuery());

    return models.map((model) => this.graphQLMapper.toResponseDto(model));
  }
}
