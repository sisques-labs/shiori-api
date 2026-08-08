import { BasePrimitives } from '@sisques-labs/nestjs-kit';

export interface IKnowledgeBasePrimitives extends BasePrimitives {
  name: string;
  description: string | null;
  apiKeyHash: string;
  embeddingModel: string;
  embeddingStatus: string;
}
