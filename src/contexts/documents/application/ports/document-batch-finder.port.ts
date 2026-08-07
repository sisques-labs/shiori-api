import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';

export const DOCUMENT_BATCH_FINDER_PORT = Symbol('DOCUMENT_BATCH_FINDER_PORT');

export interface IDocumentBatchFinderPort {
  findBatch(
    page: number,
    perPage: number,
  ): Promise<PaginatedResult<DocumentAggregate>>;
}
