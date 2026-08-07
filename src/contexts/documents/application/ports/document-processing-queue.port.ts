export const DOCUMENT_PROCESSING_QUEUE_PORT = Symbol(
  'DOCUMENT_PROCESSING_QUEUE_PORT',
);

/**
 * Hexagonal seam for enqueueing an async chunking job. `BullmqDocumentProcessingQueueService`
 * is the default implementation, backed by the `documents` BullMQ queue.
 */
export interface IDocumentProcessingQueuePort {
  enqueueChunking(documentId: string, knowledgeBaseId: string): Promise<void>;
}
