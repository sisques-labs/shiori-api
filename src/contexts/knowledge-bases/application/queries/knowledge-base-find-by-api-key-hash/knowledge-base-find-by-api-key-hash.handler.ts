import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  KNOWLEDGE_BASE_READ_REPOSITORY,
  IKnowledgeBaseReadRepository,
} from '@contexts/knowledge-bases/domain/repositories/read/knowledge-base-read.repository';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';

import { KnowledgeBaseFindByApiKeyHashQuery } from './knowledge-base-find-by-api-key-hash.query';

@QueryHandler(KnowledgeBaseFindByApiKeyHashQuery)
export class KnowledgeBaseFindByApiKeyHashQueryHandler implements IQueryHandler<
  KnowledgeBaseFindByApiKeyHashQuery,
  KnowledgeBaseViewModel | null
> {
  private readonly logger = new Logger(
    KnowledgeBaseFindByApiKeyHashQueryHandler.name,
  );

  constructor(
    @Inject(KNOWLEDGE_BASE_READ_REPOSITORY)
    private readonly readRepository: IKnowledgeBaseReadRepository,
  ) {}

  async execute(
    query: KnowledgeBaseFindByApiKeyHashQuery,
  ): Promise<KnowledgeBaseViewModel | null> {
    this.logger.log(
      `Resolving knowledge base by API key hash prefix: ${query.hash.slice(0, 8)}…`,
    );

    return this.readRepository.findByApiKeyHash(query.hash);
  }
}
