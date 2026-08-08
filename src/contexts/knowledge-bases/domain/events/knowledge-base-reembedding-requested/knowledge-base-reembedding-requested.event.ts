import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { IKnowledgeBaseReembeddingRequestedEventData } from '@contexts/knowledge-bases/domain/events/interfaces/knowledge-base-reembedding-requested-event-data.interface';

/**
 * Consumed cross-context by `embeddings`' `KnowledgeBaseReembeddingRequestedListener`
 * (`infrastructure/adapters/`), which enqueues the re-embed job with
 * `previousModel === newModel` — a forced rewrite under the same model, not
 * a model switch.
 */
export class KnowledgeBaseReembeddingRequestedEvent extends BaseEvent<IKnowledgeBaseReembeddingRequestedEventData> {
  constructor(
    metadata: IEventMetadata,
    data: IKnowledgeBaseReembeddingRequestedEventData,
  ) {
    super(metadata, data);
  }
}
