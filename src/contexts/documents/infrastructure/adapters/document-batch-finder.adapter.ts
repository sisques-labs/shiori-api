import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { IDocumentBatchFinderPort } from '@contexts/documents/application/ports/document-batch-finder.port';
import { DocumentFindBatchQuery } from '@contexts/documents/application/queries/document-find-batch/document-find-batch.query';

@Injectable()
export class DocumentBatchFinderAdapter implements IDocumentBatchFinderPort {
  constructor(private readonly queryBus: QueryBus) {}

  async findBatch(
    page: number,
    perPage: number,
  ): Promise<PaginatedResult<DocumentAggregate>> {
    return this.queryBus.execute<
      DocumentFindBatchQuery,
      PaginatedResult<DocumentAggregate>
    >(new DocumentFindBatchQuery({ page, perPage }));
  }
}
