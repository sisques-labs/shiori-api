import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { IKnowledgeBaseEventData } from '@contexts/knowledge-bases/domain/events/interfaces/knowledge-base-event-data.interface';

export class KnowledgeBaseUpdatedEvent extends BaseEvent<IKnowledgeBaseEventData> {
  constructor(metadata: IEventMetadata, data: IKnowledgeBaseEventData) {
    super(metadata, data);
  }
}
