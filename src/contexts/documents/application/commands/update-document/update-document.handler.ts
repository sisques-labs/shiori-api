import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { DocumentContentTooLargeException } from '@contexts/documents/domain/exceptions/document-content-too-large.exception';
import {
  DOCUMENT_WRITE_REPOSITORY,
  IDocumentWriteRepository,
} from '@contexts/documents/domain/repositories/write/document-write.repository';
import {
  CHUNK_WRITE_REPOSITORY,
  IChunkWriteRepository,
} from '@contexts/documents/domain/repositories/write/chunk-write.repository';
import { AssertDocumentExistsService } from '@contexts/documents/application/services/write/assert-document-exists/assert-document-exists.service';
import {
  DOCUMENT_PROCESSING_QUEUE_PORT,
  IDocumentProcessingQueuePort,
} from '@contexts/documents/application/ports/document-processing-queue.port';
import { DocumentsConfig } from '@contexts/documents/infrastructure/config/documents.config';

import { UpdateDocumentCommand } from './update-document.command';

@CommandHandler(UpdateDocumentCommand)
export class UpdateDocumentCommandHandler
  extends BaseCommandHandler<UpdateDocumentCommand, DocumentAggregate>
  implements ICommandHandler<UpdateDocumentCommand, void>
{
  private readonly logger = new Logger(UpdateDocumentCommandHandler.name);
  private readonly maxContentLength: number;

  constructor(
    @Inject(DOCUMENT_WRITE_REPOSITORY)
    private readonly writeRepository: IDocumentWriteRepository,
    @Inject(CHUNK_WRITE_REPOSITORY)
    private readonly chunkWriteRepository: IChunkWriteRepository,
    private readonly assertExists: AssertDocumentExistsService,
    @Inject(DOCUMENT_PROCESSING_QUEUE_PORT)
    private readonly processingQueue: IDocumentProcessingQueuePort,
    configService: ConfigService,
    eventBus: EventBus,
  ) {
    super(eventBus);
    this.maxContentLength =
      configService.getOrThrow<DocumentsConfig>('documents').maxContentLength;
  }

  async execute(command: UpdateDocumentCommand): Promise<void> {
    if (
      command.content != null &&
      command.content.value.length > this.maxContentLength
    ) {
      throw new DocumentContentTooLargeException(
        command.content.value.length,
        this.maxContentLength,
      );
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
