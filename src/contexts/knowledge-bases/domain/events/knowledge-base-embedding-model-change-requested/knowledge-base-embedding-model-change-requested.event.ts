import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { IKnowledgeBaseEmbeddingModelChangeRequestedEventData } from '@contexts/knowledge-bases/domain/events/interfaces/knowledge-base-embedding-model-change-requested-event-data.interface';

/**
 * Consumed cross-context by `embeddings`' `KnowledgeBaseEmbeddingModelChangedListener`
 * (`infrastructure/adapters/`), which enqueues the re-embed job.
 */
export class KnowledgeBaseEmbeddingModelChangeRequestedEvent extends BaseEvent<IKnowledgeBaseEmbeddingModelChangeRequestedEventData> {
  constructor(
    metadata: IEventMetadata,
    data: IKnowledgeBaseEmbeddingModelChangeRequestedEventData,
  ) {
    super(metadata, data);
  }
}
