import { Injectable, Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { DeleteEmbeddingsByDocumentCommand } from '@contexts/retrieval/application/commands/delete-embeddings-by-document/delete-embeddings-by-document.command';
import { DocumentChunkingStartedEvent } from '@contexts/documents/domain/events/document-chunking-started/document-chunking-started.event';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

/**
 * Fires every time `documents` starts a chunking run, including re-chunks
 * after a content update. Clears any existing embeddings for the document
 * before the new chunks are written, so stale and fresh embeddings never
 * coexist for the same document.
 */
@Injectable()
@EventsHandler(DocumentChunkingStartedEvent)
export class DocumentChunkingStartedListener implements IEventHandler<DocumentChunkingStartedEvent> {
  private readonly logger = new Logger(DocumentChunkingStartedListener.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {}

  async handle(event: DocumentChunkingStartedEvent): Promise<void> {
    const { id: documentId, knowledgeBaseId } = event.data;

    this.logger.log(`Clearing stale embeddings for document: ${documentId}`);

    await this.knowledgeBaseContext.run(knowledgeBaseId, () =>
      this.commandBus.execute(
        new DeleteEmbeddingsByDocumentCommand({ documentId }),
      ),
    );
  }
}
