import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import {
  DOCUMENT_READ_REPOSITORY,
  IDocumentReadRepository,
} from '@contexts/documents/domain/repositories/read/document-read.repository';
import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';

import { DocumentFindByCriteriaQuery } from './document-find-by-criteria.query';

@QueryHandler(DocumentFindByCriteriaQuery)
export class DocumentFindByCriteriaQueryHandler implements IQueryHandler<
  DocumentFindByCriteriaQuery,
  PaginatedResult<DocumentViewModel>
> {
  private readonly logger = new Logger(DocumentFindByCriteriaQueryHandler.name);

  constructor(
    @Inject(DOCUMENT_READ_REPOSITORY)
    private readonly readRepository: IDocumentReadRepository,
  ) {}

  async execute(
    query: DocumentFindByCriteriaQuery,
  ): Promise<PaginatedResult<DocumentViewModel>> {
    this.logger.log('Finding documents by criteria');
    return this.readRepository.findByCriteria(query.criteria);
  }
}
