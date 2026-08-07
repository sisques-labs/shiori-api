import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeleteDocumentsByKnowledgeBaseService } from '@contexts/documents/application/services/write/delete-documents-by-knowledge-base/delete-documents-by-knowledge-base.service';

import { DeleteDocumentsByKnowledgeBaseCommand } from './delete-documents-by-knowledge-base.command';

/**
 * Internal-only — no transport surface. Invoked by `KnowledgeBaseDeletedListener`,
 * which runs it inside its own `knowledgeBaseContext.run()` frame (there is no
 * HTTP request driving this path), so the tenant repositories used by
 * `DeleteDocumentsByKnowledgeBaseService` are already scoped to the
 * knowledge base being deleted.
 */
@CommandHandler(DeleteDocumentsByKnowledgeBaseCommand)
export class DeleteDocumentsByKnowledgeBaseCommandHandler implements ICommandHandler<
  DeleteDocumentsByKnowledgeBaseCommand,
  void
> {
  constructor(
    private readonly deleteDocumentsByKnowledgeBase: DeleteDocumentsByKnowledgeBaseService,
  ) {}

  async execute(command: DeleteDocumentsByKnowledgeBaseCommand): Promise<void> {
    await this.deleteDocumentsByKnowledgeBase.execute(command.knowledgeBaseId);
  }
}
