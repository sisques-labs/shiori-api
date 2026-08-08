export const EMBEDDING_REEMBED_QUEUE_PORT = Symbol(
  'EMBEDDING_REEMBED_QUEUE_PORT',
);

/**
 * Hexagonal seam for enqueueing an async re-embed job.
 * `BullmqEmbeddingReembedQueueService` is the default implementation,
 * backed by the same `embeddings` BullMQ queue the normal embed pipeline
 * uses (a new job name, not a new queue).
 */
export interface IEmbeddingReembedQueuePort {
  enqueueReembed(
    knowledgeBaseId: string,
    previousModel: string,
    newModel: string,
  ): Promise<void>;
}
