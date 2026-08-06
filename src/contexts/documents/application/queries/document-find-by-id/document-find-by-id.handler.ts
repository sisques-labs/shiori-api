import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  DOCUMENT_READ_REPOSITORY,
  IDocumentReadRepository,
} from '@contexts/documents/domain/repositories/read/document-read.repository';
import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';

import { DocumentFindByIdQuery } from './document-find-by-id.query';

@QueryHandler(DocumentFindByIdQuery)
export class DocumentFindByIdQueryHandler implements IQueryHandler<
  DocumentFindByIdQuery,
  DocumentViewModel | null
> {
  private readonly logger = new Logger(DocumentFindByIdQueryHandler.name);

  constructor(
    @Inject(DOCUMENT_READ_REPOSITORY)
    private readonly readRepository: IDocumentReadRepository,
  ) {}

  async execute(
    query: DocumentFindByIdQuery,
  ): Promise<DocumentViewModel | null> {
    this.logger.log(`Finding document: ${query.id}`);

    return this.readRepository.findById(query.id);
  }
}
