import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { AssertDocumentExistsService } from '@contexts/documents/application/services/write/assert-document-exists/assert-document-exists.service';
import {
  DOCUMENT_WRITE_REPOSITORY,
  IDocumentWriteRepository,
} from '@contexts/documents/domain/repositories/write/document-write.repository';
import {
  CHUNK_WRITE_REPOSITORY,
  IChunkWriteRepository,
} from '@contexts/documents/domain/repositories/write/chunk-write.repository';

import { DeleteDocumentCommand } from './delete-document.command';

@CommandHandler(DeleteDocumentCommand)
export class DeleteDocumentCommandHandler
  extends BaseCommandHandler<DeleteDocumentCommand, DocumentAggregate>
  implements ICommandHandler<DeleteDocumentCommand, void>
{
  private readonly logger = new Logger(DeleteDocumentCommandHandler.name);

  constructor(
    @Inject(DOCUMENT_WRITE_REPOSITORY)
    private readonly writeRepository: IDocumentWriteRepository,
    @Inject(CHUNK_WRITE_REPOSITORY)
    private readonly chunkWriteRepository: IChunkWriteRepository,
    private readonly assertExists: AssertDocumentExistsService,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: DeleteDocumentCommand): Promise<void> {
    const document = await this.assertExists.execute(command.id);

    document.delete();

    await this.chunkWriteRepository.deleteByDocumentId(document.id.value);
    await this.writeRepository.delete(document.id.value);
    await this.publishEvents(document);

    this.logger.log(`Document deleted: ${command.id.value}`);
  }
}
