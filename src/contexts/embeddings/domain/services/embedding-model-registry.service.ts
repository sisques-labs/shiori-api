import { Injectable } from '@nestjs/common';

import {
  EMBEDDING_MODELS_REGISTRY,
  EmbeddingModelDefinition,
} from '@contexts/embeddings/domain/constants/embedding-models-registry.constant';
import { UnknownEmbeddingModelException } from '@contexts/embeddings/domain/exceptions/unknown-embedding-model.exception';

/**
 * Plain domain service, no I/O — looks up `EMBEDDING_MODELS_REGISTRY`, the
 * single source of truth for which models are selectable and what
 * dimension each one produces.
 */
@Injectable()
export class EmbeddingModelRegistryService {
  findById(modelId: string): EmbeddingModelDefinition | null {
    return (
      EMBEDDING_MODELS_REGISTRY.find((model) => model.id === modelId) ?? null
    );
  }

  getOrThrow(modelId: string): EmbeddingModelDefinition {
    const model = this.findById(modelId);
    if (!model) throw new UnknownEmbeddingModelException(modelId);
    return model;
  }

  listAll(): readonly EmbeddingModelDefinition[] {
    return EMBEDDING_MODELS_REGISTRY;
  }
}
