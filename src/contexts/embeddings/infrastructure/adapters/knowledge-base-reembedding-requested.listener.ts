import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import {
  EMBEDDING_REEMBED_QUEUE_PORT,
  IEmbeddingReembedQueuePort,
} from '@contexts/embeddings/application/ports/embedding-reembed-queue.port';
import { KnowledgeBaseReembeddingRequestedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-reembedding-requested/knowledge-base-reembedding-requested.event';

/**
 * Reacts to `knowledge-bases`' `KnowledgeBaseReembeddingRequestedEvent` — a
 * forced re-embed under the Knowledge Base's CURRENT model, as opposed to
 * `KnowledgeBaseEmbeddingModelChangedListener`'s reaction to an actual model
 * switch. Enqueues the same `embeddings` re-embed job with
 * `previousModel === newModel`; `ReembedKnowledgeBaseProcessor` skips its
 * "delete previous model" cleanup step in that case so the freshly
 * re-embedded rows aren't wiped.
 */
@Injectable()
@EventsHandler(KnowledgeBaseReembeddingRequestedEvent)
export class KnowledgeBaseReembeddingRequestedListener implements IEventHandler<KnowledgeBaseReembeddingRequestedEvent> {
  private readonly logger = new Logger(
    KnowledgeBaseReembeddingRequestedListener.name,
  );

  constructor(
    @Inject(EMBEDDING_REEMBED_QUEUE_PORT)
    private readonly reembedQueue: IEmbeddingReembedQueuePort,
  ) {}

  async handle(event: KnowledgeBaseReembeddingRequestedEvent): Promise<void> {
    const { knowledgeBaseId, model } = event.data;

    this.logger.log(
      `Queuing forced re-embed for knowledge base: ${knowledgeBaseId} (${model})`,
    );

    await this.reembedQueue.enqueueReembed(knowledgeBaseId, model, model);
  }
}
