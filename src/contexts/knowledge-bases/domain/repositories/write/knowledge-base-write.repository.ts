import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';

export const KNOWLEDGE_BASE_WRITE_REPOSITORY = Symbol(
  'KNOWLEDGE_BASE_WRITE_REPOSITORY',
);

export type IKnowledgeBaseWriteRepository =
  IBaseWriteRepository<KnowledgeBaseAggregate>;
