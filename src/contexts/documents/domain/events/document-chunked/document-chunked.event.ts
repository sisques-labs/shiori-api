import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { IDocumentEventData } from '@contexts/documents/domain/events/interfaces/document-event-data.interface';

/** Future integration point for `retrieval`: embed the document's chunks once this fires. */
export class DocumentChunkedEvent extends BaseEvent<IDocumentEventData> {
  constructor(metadata: IEventMetadata, data: IDocumentEventData) {
    super(metadata, data);
  }
}
