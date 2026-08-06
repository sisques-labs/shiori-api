export const EMBEDDING_PROCESSING_QUEUE_PORT = Symbol(
  'EMBEDDING_PROCESSING_QUEUE_PORT',
);

/**
 * Hexagonal seam for enqueueing an async embedding job. `BullmqEmbeddingProcessingQueueService`
 * is the default implementation, backed by the `retrieval` BullMQ queue.
 */
export interface IEmbeddingProcessingQueuePort {
  enqueueEmbedding(documentId: string, knowledgeBaseId: string): Promise<void>;
}
