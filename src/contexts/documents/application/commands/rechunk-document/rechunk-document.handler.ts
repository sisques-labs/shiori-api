import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { AssertDocumentExistsService } from '@contexts/documents/application/services/write/assert-document-exists/assert-document-exists.service';
import {
  DOCUMENT_PROCESSING_QUEUE_PORT,
  IDocumentProcessingQueuePort,
} from '@contexts/documents/application/ports/document-processing-queue.port';
import {
  DOCUMENT_WRITE_REPOSITORY,
  IDocumentWriteRepository,
} from '@contexts/documents/domain/repositories/write/document-write.repository';
import {
  CHUNK_WRITE_REPOSITORY,
  IChunkWriteRepository,
} from '@contexts/documents/domain/repositories/write/chunk-write.repository';

import { RechunkDocumentCommand } from './rechunk-document.command';

@CommandHandler(RechunkDocumentCommand)
export class RechunkDocumentCommandHandler
  extends BaseCommandHandler<RechunkDocumentCommand, DocumentAggregate>
  implements ICommandHandler<RechunkDocumentCommand, void>
{
  private readonly logger = new Logger(RechunkDocumentCommandHandler.name);

  constructor(
    @Inject(DOCUMENT_WRITE_REPOSITORY)
    private readonly writeRepository: IDocumentWriteRepository,
    @Inject(CHUNK_WRITE_REPOSITORY)
    private readonly chunkWriteRepository: IChunkWriteRepository,
    private readonly assertExists: AssertDocumentExistsService,
    @Inject(DOCUMENT_PROCESSING_QUEUE_PORT)
    private readonly processingQueue: IDocumentProcessingQueuePort,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: RechunkDocumentCommand): Promise<void> {
    const document = await this.assertExists.execute(command.id);

    document.requestRechunk();

    await this.chunkWriteRepository.deleteByDocumentId(document.id.value);
    await this.writeRepository.save(document);
    await this.publishEvents(document);
    await this.processingQueue.enqueueChunking(
      document.id.value,
      document.knowledgeBaseId.value,
    );

    this.logger.log(`Rechunk requested: ${command.id.value}`);
  }
}
