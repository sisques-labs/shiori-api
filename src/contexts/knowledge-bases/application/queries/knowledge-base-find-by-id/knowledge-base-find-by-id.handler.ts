import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  KNOWLEDGE_BASE_READ_REPOSITORY,
  IKnowledgeBaseReadRepository,
} from '@contexts/knowledge-bases/domain/repositories/read/knowledge-base-read.repository';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';

import { KnowledgeBaseFindByIdQuery } from './knowledge-base-find-by-id.query';

@QueryHandler(KnowledgeBaseFindByIdQuery)
export class KnowledgeBaseFindByIdQueryHandler implements IQueryHandler<
  KnowledgeBaseFindByIdQuery,
  KnowledgeBaseViewModel | null
> {
  private readonly logger = new Logger(KnowledgeBaseFindByIdQueryHandler.name);

  constructor(
    @Inject(KNOWLEDGE_BASE_READ_REPOSITORY)
    private readonly readRepository: IKnowledgeBaseReadRepository,
  ) {}

  async execute(
    query: KnowledgeBaseFindByIdQuery,
  ): Promise<KnowledgeBaseViewModel | null> {
    this.logger.log(`Finding knowledge base: ${query.id}`);

    return this.readRepository.findById(query.id);
  }
}
