import { Injectable, Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { DeleteEmbeddingsByDocumentCommand } from '@contexts/retrieval/application/commands/delete-embeddings-by-document/delete-embeddings-by-document.command';
import { DocumentDeletedEvent } from '@contexts/documents/domain/events/document-deleted/document-deleted.event';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

@Injectable()
@EventsHandler(DocumentDeletedEvent)
export class DocumentDeletedListener implements IEventHandler<DocumentDeletedEvent> {
  private readonly logger = new Logger(DocumentDeletedListener.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {}

  async handle(event: DocumentDeletedEvent): Promise<void> {
    const { id: documentId, knowledgeBaseId } = event.data;

    this.logger.log(`Deleting embeddings for document: ${documentId}`);

    await this.knowledgeBaseContext.run(knowledgeBaseId, () =>
      this.commandBus.execute(
        new DeleteEmbeddingsByDocumentCommand({ documentId }),
      ),
    );
  }
}
