import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { IKnowledgeBaseEmbeddingConfig } from '@contexts/embeddings/application/ports/knowledge-base-embedding-config.interface';
import { IKnowledgeBaseEmbeddingConfigPort } from '@contexts/embeddings/application/ports/knowledge-base-embedding-config.port';
import { KnowledgeBaseFindByIdQuery } from '@contexts/knowledge-bases/application/queries/knowledge-base-find-by-id/knowledge-base-find-by-id.query';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
import { KnowledgeBaseNotFoundException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-not-found.exception';

/**
 * Implements `IKnowledgeBaseEmbeddingConfigPort` by dispatching
 * `knowledge-bases`' `KnowledgeBaseFindByIdQuery` through the global
 * QueryBus — the established cross-context read seam in this codebase (see
 * `DocumentChunkSourceAdapter` in this same context, or `retrieval`'s
 * `EmbeddingSearchAdapter`). No context ever imports another context's
 * module or repository token directly; only its Command/Query classes.
 */
@Injectable()
export class KnowledgeBaseEmbeddingConfigAdapter implements IKnowledgeBaseEmbeddingConfigPort {
  constructor(private readonly queryBus: QueryBus) {}

  async getByKnowledgeBaseId(
    knowledgeBaseId: string,
  ): Promise<IKnowledgeBaseEmbeddingConfig> {
    const knowledgeBase = await this.queryBus.execute<
      KnowledgeBaseFindByIdQuery,
      KnowledgeBaseViewModel | null
    >(new KnowledgeBaseFindByIdQuery({ id: knowledgeBaseId }));

    if (!knowledgeBase) {
      throw new KnowledgeBaseNotFoundException(knowledgeBaseId);
    }

    return {
      embeddingModel: knowledgeBase.embeddingModel,
      embeddingStatus:
        knowledgeBase.embeddingStatus as IKnowledgeBaseEmbeddingConfig['embeddingStatus'],
    };
  }
}
