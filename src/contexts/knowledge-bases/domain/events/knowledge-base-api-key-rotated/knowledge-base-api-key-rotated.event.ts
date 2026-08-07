import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { IKnowledgeBaseEventData } from '@contexts/knowledge-bases/domain/events/interfaces/knowledge-base-event-data.interface';

/**
 * Payload deliberately excludes the key and its hash — event data must never
 * carry credential material.
 */
export class KnowledgeBaseApiKeyRotatedEvent extends BaseEvent<IKnowledgeBaseEventData> {
  constructor(metadata: IEventMetadata, data: IKnowledgeBaseEventData) {
    super(metadata, data);
  }
}
