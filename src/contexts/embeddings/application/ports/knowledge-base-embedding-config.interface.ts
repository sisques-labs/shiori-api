export interface IKnowledgeBaseEmbeddingConfig {
  embeddingModel: string;
  embeddingStatus: 'READY' | 'REEMBEDDING' | 'FAILED';
}
