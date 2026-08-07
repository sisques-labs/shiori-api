import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import {
  DOCUMENT_WRITE_REPOSITORY,
  IDocumentWriteRepository,
} from '@contexts/documents/domain/repositories/write/document-write.repository';
import {
  CHUNK_WRITE_REPOSITORY,
  IChunkWriteRepository,
} from '@contexts/documents/domain/repositories/write/chunk-write.repository';
import { AssertDocumentExistsService } from '@contexts/documents/application/services/write/assert-document-exists/assert-document-exists.service';
import { AssertDocumentContentNotTooLargeService } from '@contexts/documents/application/services/write/assert-document-content-not-too-large/assert-document-content-not-too-large.service';
import {
  DOCUMENT_PROCESSING_QUEUE_PORT,
  IDocumentProcessingQueuePort,
} from '@contexts/documents/application/ports/document-processing-queue.port';

import { UpdateDocumentCommand } from './update-document.command';

@CommandHandler(UpdateDocumentCommand)
export class UpdateDocumentCommandHandler
  extends BaseCommandHandler<UpdateDocumentCommand, DocumentAggregate>
  implements ICommandHandler<UpdateDocumentCommand, void>
{
  private readonly logger = new Logger(UpdateDocumentCommandHandler.name);

  constructor(
    @Inject(DOCUMENT_WRITE_REPOSITORY)
    private readonly writeRepository: IDocumentWriteRepository,
    @Inject(CHUNK_WRITE_REPOSITORY)
    private readonly chunkWriteRepository: IChunkWriteRepository,
    private readonly assertExists: AssertDocumentExistsService,
    @Inject(DOCUMENT_PROCESSING_QUEUE_PORT)
    private readonly processingQueue: IDocumentProcessingQueuePort,
    private readonly assertContentNotTooLarge: AssertDocumentContentNotTooLargeService,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: UpdateDocumentCommand): Promise<void> {
    if (command.content != null) {
      await this.assertContentNotTooLarge.execute(command.content.value);
    }

    const document = await this.assertExists.execute(command.id);
    const contentChanged = command.content !== undefined;

    document.update({ title: command.title, content: command.content });

    if (contentChanged) {
      await this.chunkWriteRepository.deleteByDocumentId(document.id.value);
    }

    await this.writeRepository.save(document);
    await this.publishEvents(document);

    if (contentChanged) {
      await this.processingQueue.enqueueChunking(
        document.id.value,
        document.knowledgeBaseId.value,
      );
    }

    this.logger.log(`Document updated: ${command.id.value}`);
  }
}
