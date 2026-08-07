import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import {
  EMBEDDING_WRITE_REPOSITORY,
  IEmbeddingWriteRepository,
} from '@contexts/embeddings/domain/repositories/write/embedding-write.repository';

import { DeleteEmbeddingsByDocumentCommand } from './delete-embeddings-by-document.command';

/**
 * Internal-only — no transport surface. Invoked by
 * `DocumentChunkingStartedListener` (clears stale embeddings before a
 * re-chunk) and `DocumentDeletedListener`.
 */
@CommandHandler(DeleteEmbeddingsByDocumentCommand)
export class DeleteEmbeddingsByDocumentCommandHandler implements ICommandHandler<
  DeleteEmbeddingsByDocumentCommand,
  void
> {
  private readonly logger = new Logger(
    DeleteEmbeddingsByDocumentCommandHandler.name,
  );

  constructor(
    @Inject(EMBEDDING_WRITE_REPOSITORY)
    private readonly writeRepository: IEmbeddingWriteRepository,
  ) {}

  async execute(command: DeleteEmbeddingsByDocumentCommand): Promise<void> {
    await this.writeRepository.deleteByDocumentId(command.documentId);

    this.logger.log(`Deleted embeddings for document: ${command.documentId}`);
  }
}
