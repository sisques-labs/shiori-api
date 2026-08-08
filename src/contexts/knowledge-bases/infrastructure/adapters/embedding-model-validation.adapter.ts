import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { IEmbeddingModelValidationPort } from '@contexts/knowledge-bases/application/ports/embedding-model-validation.port';
import { EmbeddingModelExistsQuery } from '@contexts/embeddings/application/queries/embedding-model-exists/embedding-model-exists.query';

/**
 * Implements `IEmbeddingModelValidationPort` by dispatching `embeddings`'
 * internal `EmbeddingModelExistsQuery` through the global QueryBus — the
 * established cross-context read seam in this codebase (see this same
 * context's `HashApiKeyAdapter`, or `embeddings`' own
 * `DocumentChunkSourceAdapter`). No context ever imports another context's
 * module or repository token directly.
 */
@Injectable()
export class EmbeddingModelValidationAdapter implements IEmbeddingModelValidationPort {
  constructor(private readonly queryBus: QueryBus) {}

  async isValid(modelId: string): Promise<boolean> {
    return this.queryBus.execute<EmbeddingModelExistsQuery, boolean>(
      new EmbeddingModelExistsQuery({ modelId }),
    );
  }
}
