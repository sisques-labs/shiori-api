import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { IDocumentEventData } from '@contexts/documents/domain/events/interfaces/document-event-data.interface';

export class DocumentChunkingStartedEvent extends BaseEvent<IDocumentEventData> {
  constructor(metadata: IEventMetadata, data: IDocumentEventData) {
    super(metadata, data);
  }
}
