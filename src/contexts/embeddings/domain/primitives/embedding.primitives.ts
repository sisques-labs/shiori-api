import { BasePrimitives } from '@sisques-labs/nestjs-kit';

export interface IEmbeddingPrimitives extends BasePrimitives {
  knowledgeBaseId: string;
  documentId: string;
  chunkId: string;
  chunkText: string;
  chunkPosition: number;
  embedding: number[];
  model: string;
}
