import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Criteria, PaginatedResult } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import {
  DOCUMENT_WRITE_REPOSITORY,
  IDocumentWriteRepository,
} from '@contexts/documents/domain/repositories/write/document-write.repository';

import { DocumentFindBatchQuery } from './document-find-batch.query';

@QueryHandler(DocumentFindBatchQuery)
export class DocumentFindBatchQueryHandler implements IQueryHandler<
  DocumentFindBatchQuery,
  PaginatedResult<DocumentAggregate>
> {
  constructor(
    @Inject(DOCUMENT_WRITE_REPOSITORY)
    private readonly writeRepository: IDocumentWriteRepository,
  ) {}

  async execute(
    query: DocumentFindBatchQuery,
  ): Promise<PaginatedResult<DocumentAggregate>> {
    return this.writeRepository.findByCriteria(
      new Criteria([], [], { page: query.page, perPage: query.perPage }),
    );
  }
}
