import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';

export type IKnowledgeBaseEventData = Omit<
  IKnowledgeBasePrimitives,
  'apiKeyHash'
>;
