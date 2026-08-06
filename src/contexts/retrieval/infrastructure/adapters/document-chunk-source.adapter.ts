import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import {
  IChunkSourceItem,
  IChunkSourcePort,
} from '@contexts/retrieval/application/ports/chunk-source.port';
import {
  ChunkFindByDocumentIdQuery,
  ChunkFindByDocumentIdQueryInput,
} from '@contexts/documents/application/queries/chunk-find-by-document-id/chunk-find-by-document-id.query';
import { ChunkFindByDocumentIdResult } from '@contexts/documents/application/queries/chunk-find-by-document-id/chunk-find-by-document-id.handler';

/**
 * Implements `ChunkSourcePort` by dispatching `documents`' internal-only
 * `ChunkFindByDocumentIdQuery` through the global QueryBus — the
 * established cross-context read seam in this codebase (see
 * `care-schedule`'s `CareLogAdapter` in the sibling gardenia-api service).
 * No context ever imports another context's module or repository token
 * directly; only its Command/Query classes, which is what ESLint's
 * `infrastructure/adapters/**` boundary exception is for.
 */
@Injectable()
export class DocumentChunkSourceAdapter implements IChunkSourcePort {
  constructor(private readonly queryBus: QueryBus) {}

  async findByDocumentId(documentId: string): Promise<IChunkSourceItem[]> {
    const results = await this.queryBus.execute<
      ChunkFindByDocumentIdQuery,
      ChunkFindByDocumentIdResult[]
    >(
      new ChunkFindByDocumentIdQuery({
        documentId,
      } satisfies ChunkFindByDocumentIdQueryInput),
    );

    return results.map((result) => ({
      id: result.id,
      text: result.text,
      position: result.position,
    }));
  }
}
