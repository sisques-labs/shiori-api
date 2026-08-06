import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';

export const KNOWLEDGE_BASE_READ_REPOSITORY = Symbol(
  'KNOWLEDGE_BASE_READ_REPOSITORY',
);

export interface IKnowledgeBaseReadRepository extends IBaseReadRepository<KnowledgeBaseViewModel> {
  findByApiKeyHash(hash: string): Promise<KnowledgeBaseViewModel | null>;
}
