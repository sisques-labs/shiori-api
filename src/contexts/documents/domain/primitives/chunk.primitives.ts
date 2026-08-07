import { BasePrimitives } from '@sisques-labs/nestjs-kit';

export interface IChunkPrimitives extends BasePrimitives {
  documentId: string;
  knowledgeBaseId: string;
  position: number;
  text: string;
}
