import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import {
  IEmbeddingSearchPort,
  IRetrievalSearchResult,
} from '@contexts/retrieval/application/ports/embedding-search.port';
import { EmbeddingSearchQuery } from '@contexts/embeddings/application/queries/embedding-search/embedding-search.query';
import { IEmbeddingSearchResult } from '@contexts/embeddings/domain/repositories/read/embedding-read.repository';

/**
 * Implements `EmbeddingSearchPort` by dispatching `embeddings`' internal-only
 * `EmbeddingSearchQuery` through the global QueryBus — the established
 * cross-context read seam in this codebase (see `documents`'
 * `DocumentChunkSourceAdapter` in `embeddings`, or `care-schedule`'s
 * `CareLogAdapter` in the sibling gardenia-api service). No context ever
 * imports another context's module or repository token directly; only its
 * Command/Query classes, which is what ESLint's `infrastructure/adapters/**`
 * boundary exception is for.
 */
@Injectable()
export class EmbeddingSearchAdapter implements IEmbeddingSearchPort {
  constructor(private readonly queryBus: QueryBus) {}

  async search(text: string, topK: number): Promise<IRetrievalSearchResult[]> {
    const results = await this.queryBus.execute<
      EmbeddingSearchQuery,
      IEmbeddingSearchResult[]
    >(new EmbeddingSearchQuery({ text, topK }));

    return results.map((result) => ({
      chunkId: result.chunkId,
      documentId: result.documentId,
      chunkText: result.chunkText,
      chunkPosition: result.chunkPosition,
      score: result.score,
    }));
  }
}
