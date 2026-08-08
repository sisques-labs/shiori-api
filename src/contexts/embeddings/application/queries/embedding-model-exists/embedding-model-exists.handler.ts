import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';

import { EmbeddingModelExistsQuery } from './embedding-model-exists.query';

@QueryHandler(EmbeddingModelExistsQuery)
export class EmbeddingModelExistsQueryHandler implements IQueryHandler<
  EmbeddingModelExistsQuery,
  boolean
> {
  private readonly logger = new Logger(EmbeddingModelExistsQueryHandler.name);

  constructor(private readonly modelRegistry: EmbeddingModelRegistryService) {}

  async execute(query: EmbeddingModelExistsQuery): Promise<boolean> {
    this.logger.log(`Checking embedding model exists: ${query.modelId}`);

    return this.modelRegistry.findById(query.modelId) !== null;
  }
}
