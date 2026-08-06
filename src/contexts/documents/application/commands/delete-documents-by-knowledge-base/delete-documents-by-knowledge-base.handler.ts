import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Criteria } from '@sisques-labs/nestjs-kit';

import {
  DOCUMENT_WRITE_REPOSITORY,
  IDocumentWriteRepository,
} from '@contexts/documents/domain/repositories/write/document-write.repository';
import {
  CHUNK_WRITE_REPOSITORY,
  IChunkWriteRepository,
} from '@contexts/documents/domain/repositories/write/chunk-write.repository';

import { DeleteDocumentsByKnowledgeBaseCommand } from './delete-documents-by-knowledge-base.command';

const DELETE_BATCH_SIZE = 100;

/**
 * Internal-only — no transport surface. Invoked by `KnowledgeBaseDeletedListener`,
 * which runs it inside its own `knowledgeBaseContext.run()` frame (there is no
 * HTTP request driving this path), so the tenant repositories here are already
 * scoped to the knowledge base being deleted.
 */
@CommandHandler(DeleteDocumentsByKnowledgeBaseCommand)
export class DeleteDocumentsByKnowledgeBaseCommandHandler implements ICommandHandler<
  DeleteDocumentsByKnowledgeBaseCommand,
  void
> {
  private readonly logger = new Logger(
    DeleteDocumentsByKnowledgeBaseCommandHandler.name,
  );

  constructor(
    @Inject(DOCUMENT_WRITE_REPOSITORY)
    private readonly writeRepository: IDocumentWriteRepository,
    @Inject(CHUNK_WRITE_REPOSITORY)
    private readonly chunkWriteRepository: IChunkWriteRepository,
  ) {}

  async execute(command: DeleteDocumentsByKnowledgeBaseCommand): Promise<void> {
    let deleted = 0;
    let page = await this.writeRepository.findByCriteria(
      new Criteria([], [], { page: 1, perPage: DELETE_BATCH_SIZE }),
    );

    while (page.items.length > 0) {
      for (const document of page.items) {
        await this.chunkWriteRepository.deleteByDocumentId(document.id.value);
        await this.writeRepository.delete(document.id.value);
        deleted += 1;
      }
      page = await this.writeRepository.findByCriteria(
        new Criteria([], [], { page: 1, perPage: DELETE_BATCH_SIZE }),
      );
    }

    this.logger.log(
      `Deleted ${deleted} documents for knowledge base: ${command.knowledgeBaseId}`,
    );
  }
}
