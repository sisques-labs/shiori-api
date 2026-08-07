import { Injectable, Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { DeleteDocumentsByKnowledgeBaseCommand } from '@contexts/documents/application/commands/delete-documents-by-knowledge-base/delete-documents-by-knowledge-base.command';
import { KnowledgeBaseDeletedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-deleted/knowledge-base-deleted.event';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

/**
 * Cascade cleanup for the `KnowledgeBaseDeleted` event. Runs inside its own
 * `knowledgeBaseContext.run()` frame — like `ChunkDocumentProcessor`, this
 * fires from an event bus dispatch, not a guarded HTTP request, so there is
 * no ambient tenancy context for the tenant repositories to pick up.
 */
@Injectable()
@EventsHandler(KnowledgeBaseDeletedEvent)
export class KnowledgeBaseDeletedListener implements IEventHandler<KnowledgeBaseDeletedEvent> {
  private readonly logger = new Logger(KnowledgeBaseDeletedListener.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {}

  async handle(event: KnowledgeBaseDeletedEvent): Promise<void> {
    const knowledgeBaseId = event.data.id;

    this.logger.log(
      `Cascading document deletion for knowledge base: ${knowledgeBaseId}`,
    );

    await this.knowledgeBaseContext.run(knowledgeBaseId, () =>
      this.commandBus.execute(
        new DeleteDocumentsByKnowledgeBaseCommand({ knowledgeBaseId }),
      ),
    );
  }
}
