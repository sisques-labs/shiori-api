import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import {
  EMBEDDING_PROCESSING_QUEUE_PORT,
  IEmbeddingProcessingQueuePort,
} from '@contexts/embeddings/application/ports/embedding-processing-queue.port';
import { DocumentChunkedEvent } from '@contexts/documents/domain/events/document-chunked/document-chunked.event';

/**
 * Enqueues the embedding job once `documents` finishes chunking. Not a
 * dispatched command — an external HTTP call to an embeddings API needs
 * retry/backoff, so this goes through the same BullMQ pattern `documents`
 * uses for chunking itself, rather than running inline in the event
 * handler.
 */
@Injectable()
@EventsHandler(DocumentChunkedEvent)
export class DocumentChunkedListener implements IEventHandler<DocumentChunkedEvent> {
  private readonly logger = new Logger(DocumentChunkedListener.name);

  constructor(
    @Inject(EMBEDDING_PROCESSING_QUEUE_PORT)
    private readonly processingQueue: IEmbeddingProcessingQueuePort,
  ) {}

  async handle(event: DocumentChunkedEvent): Promise<void> {
    this.logger.log(`Queuing embedding for document: ${event.data.id}`);

    await this.processingQueue.enqueueEmbedding(
      event.data.id,
      event.data.knowledgeBaseId,
    );
  }
}
