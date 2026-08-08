import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { EmbeddingModelDefinition } from '@contexts/embeddings/domain/constants/embedding-models-registry.constant';
import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';

import { EmbeddingAvailableModelsQuery } from './embedding-available-models.query';

@QueryHandler(EmbeddingAvailableModelsQuery)
export class EmbeddingAvailableModelsQueryHandler implements IQueryHandler<
  EmbeddingAvailableModelsQuery,
  readonly EmbeddingModelDefinition[]
> {
  private readonly logger = new Logger(
    EmbeddingAvailableModelsQueryHandler.name,
  );

  constructor(private readonly modelRegistry: EmbeddingModelRegistryService) {}

  async execute(): Promise<readonly EmbeddingModelDefinition[]> {
    this.logger.log('Listing available embedding models');

    return this.modelRegistry.listAll();
  }
}
