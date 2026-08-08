import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import {
  EMBEDDING_REEMBED_QUEUE_PORT,
  IEmbeddingReembedQueuePort,
} from '@contexts/embeddings/application/ports/embedding-reembed-queue.port';
import { KnowledgeBaseEmbeddingModelChangeRequestedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-embedding-model-change-requested/knowledge-base-embedding-model-change-requested.event';

/**
 * Reacts to `knowledge-bases`' `KnowledgeBaseEmbeddingModelChangeRequestedEvent`
 * — the cross-context event boundary exception this codebase already uses
 * for `DocumentChunkedEvent`/`DocumentDeletedEvent`/`KnowledgeBaseDeletedEvent`
 * elsewhere in this same context. Enqueues the re-embed job; the actual
 * work happens in `ReembedKnowledgeBaseProcessor`.
 */
@Injectable()
@EventsHandler(KnowledgeBaseEmbeddingModelChangeRequestedEvent)
export class KnowledgeBaseEmbeddingModelChangedListener implements IEventHandler<KnowledgeBaseEmbeddingModelChangeRequestedEvent> {
  private readonly logger = new Logger(
    KnowledgeBaseEmbeddingModelChangedListener.name,
  );

  constructor(
    @Inject(EMBEDDING_REEMBED_QUEUE_PORT)
    private readonly reembedQueue: IEmbeddingReembedQueuePort,
  ) {}

  async handle(
    event: KnowledgeBaseEmbeddingModelChangeRequestedEvent,
  ): Promise<void> {
    const { knowledgeBaseId, previousModel, newModel } = event.data;

    this.logger.log(
      `Queuing re-embed for knowledge base: ${knowledgeBaseId} (${previousModel} -> ${newModel})`,
    );

    await this.reembedQueue.enqueueReembed(
      knowledgeBaseId,
      previousModel,
      newModel,
    );
  }
}
