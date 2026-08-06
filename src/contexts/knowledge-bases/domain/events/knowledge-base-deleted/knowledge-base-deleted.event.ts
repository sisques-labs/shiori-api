import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { IKnowledgeBaseEventData } from '@contexts/knowledge-bases/domain/events/interfaces/knowledge-base-event-data.interface';

/**
 * Future cascade hook: `documents` and `retrieval` contexts (proposed
 * separately) will subscribe to this event to clean up their own
 * `knowledgeBaseId`-scoped data.
 */
export class KnowledgeBaseDeletedEvent extends BaseEvent<IKnowledgeBaseEventData> {
  constructor(metadata: IEventMetadata, data: IKnowledgeBaseEventData) {
    super(metadata, data);
  }
}
