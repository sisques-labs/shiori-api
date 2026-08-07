import { BasePrimitives } from '@sisques-labs/nestjs-kit';

export interface IDocumentPrimitives extends BasePrimitives {
  knowledgeBaseId: string;
  title: string;
  content: string;
  status: string;
  failureReason: string | null;
  chunkCount: number;
}
