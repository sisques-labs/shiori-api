import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  DOCUMENT_READ_REPOSITORY,
  IDocumentReadRepository,
} from '@contexts/documents/domain/repositories/read/document-read.repository';

import { DocumentFindIdsByKnowledgeBaseIdQuery } from './document-find-ids-by-knowledge-base-id.query';

@QueryHandler(DocumentFindIdsByKnowledgeBaseIdQuery)
export class DocumentFindIdsByKnowledgeBaseIdQueryHandler implements IQueryHandler<
  DocumentFindIdsByKnowledgeBaseIdQuery,
  string[]
> {
  private readonly logger = new Logger(
    DocumentFindIdsByKnowledgeBaseIdQueryHandler.name,
  );

  constructor(
    @Inject(DOCUMENT_READ_REPOSITORY)
    private readonly documentReadRepository: IDocumentReadRepository,
  ) {}

  async execute(
    query: DocumentFindIdsByKnowledgeBaseIdQuery,
  ): Promise<string[]> {
    this.logger.log(
      `Finding document ids for knowledge base: ${query.knowledgeBaseId}`,
    );

    return this.documentReadRepository.findIdsByKnowledgeBaseId(
      query.knowledgeBaseId,
    );
  }
}
