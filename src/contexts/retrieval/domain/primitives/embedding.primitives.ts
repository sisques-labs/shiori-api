export interface IEmbeddingPrimitives {
  id: string;
  knowledgeBaseId: string;
  documentId: string;
  chunkId: string;
  chunkText: string;
  chunkPosition: number;
  embedding: number[];
  model: string;
  createdAt: Date;
}
