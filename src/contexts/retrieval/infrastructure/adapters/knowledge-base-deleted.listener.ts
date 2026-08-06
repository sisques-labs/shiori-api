import { Injectable, Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { DeleteEmbeddingsByKnowledgeBaseCommand } from '@contexts/retrieval/application/commands/delete-embeddings-by-knowledge-base/delete-embeddings-by-knowledge-base.command';
import { KnowledgeBaseDeletedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-deleted/knowledge-base-deleted.event';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

/**
 * Cleans up this context's own data independently of `documents`' own
 * `KnowledgeBaseDeletedListener` — relying on cross-context delete
 * ordering would create a hidden coupling.
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
      `Deleting embeddings for knowledge base: ${knowledgeBaseId}`,
    );

    await this.knowledgeBaseContext.run(knowledgeBaseId, () =>
      this.commandBus.execute(
        new DeleteEmbeddingsByKnowledgeBaseCommand({ knowledgeBaseId }),
      ),
    );
  }
}
