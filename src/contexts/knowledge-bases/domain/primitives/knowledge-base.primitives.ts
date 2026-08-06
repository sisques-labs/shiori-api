import { BasePrimitives } from '@sisques-labs/nestjs-kit';

export interface IKnowledgeBasePrimitives extends BasePrimitives {
  name: string;
  description: string | null;
  apiKeyHash: string;
}

export type IKnowledgeBaseBasePrimitives = Partial<
  Pick<IKnowledgeBasePrimitives, 'name' | 'description'>
>;
