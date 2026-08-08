import { Controller, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { EmbeddingAvailableModelsQuery } from '@contexts/embeddings/application/queries/embedding-available-models/embedding-available-models.query';
import { EmbeddingModelDefinition } from '@contexts/embeddings/domain/constants/embedding-models-registry.constant';

import { EmbeddingModelRestResponseDto } from '../dtos/embedding-model-rest-response.dto';
import { EmbeddingModelRestMapper } from '../mappers/embedding-model/embedding-model.mapper';

/**
 * `embeddings`' first (and, for now, only) transport surface: a public,
 * non-tenant, non-guarded read of the static model registry — used by
 * `knowledge-bases` API consumers to populate a model picker for
 * `POST /knowledge-bases` / `PATCH /knowledge-bases/me/embedding-model`.
 */
@ApiTags('embeddings')
@Controller('embeddings')
export class EmbeddingsController {
  private readonly logger = new Logger(EmbeddingsController.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly restMapper: EmbeddingModelRestMapper,
  ) {}

  @Get('models')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List available embedding models (no auth required)',
  })
  @ApiResponse({ status: 200, type: [EmbeddingModelRestResponseDto] })
  async listAvailableModels(): Promise<EmbeddingModelRestResponseDto[]> {
    this.logger.log('Listing available embedding models');

    const models = await this.queryBus.execute<
      EmbeddingAvailableModelsQuery,
      readonly EmbeddingModelDefinition[]
    >(new EmbeddingAvailableModelsQuery());

    return models.map((model) => this.restMapper.toResponse(model));
  }
}
