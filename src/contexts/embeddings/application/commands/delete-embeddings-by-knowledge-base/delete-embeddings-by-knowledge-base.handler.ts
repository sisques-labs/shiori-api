import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import {
  EMBEDDING_WRITE_REPOSITORY,
  IEmbeddingWriteRepository,
} from '@contexts/embeddings/domain/repositories/write/embedding-write.repository';

import { DeleteEmbeddingsByKnowledgeBaseCommand } from './delete-embeddings-by-knowledge-base.command';

/**
 * Internal-only — no transport surface. Invoked by
 * `KnowledgeBaseDeletedListener`, which runs it inside its own
 * `knowledgeBaseContext.run()` frame (there is no HTTP request driving
 * this path).
 */
@CommandHandler(DeleteEmbeddingsByKnowledgeBaseCommand)
export class DeleteEmbeddingsByKnowledgeBaseCommandHandler implements ICommandHandler<
  DeleteEmbeddingsByKnowledgeBaseCommand,
  void
> {
  private readonly logger = new Logger(
    DeleteEmbeddingsByKnowledgeBaseCommandHandler.name,
  );

  constructor(
    @Inject(EMBEDDING_WRITE_REPOSITORY)
    private readonly writeRepository: IEmbeddingWriteRepository,
  ) {}

  async execute(
    command: DeleteEmbeddingsByKnowledgeBaseCommand,
  ): Promise<void> {
    await this.writeRepository.deleteByKnowledgeBaseId(command.knowledgeBaseId);

    this.logger.log(
      `Deleted embeddings for knowledge base: ${command.knowledgeBaseId}`,
    );
  }
}
