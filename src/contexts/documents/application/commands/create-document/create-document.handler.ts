import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { DocumentBuilder } from '@contexts/documents/domain/builders/document.builder';
import { DocumentContentTooLargeException } from '@contexts/documents/domain/exceptions/document-content-too-large.exception';
import {
  DOCUMENT_WRITE_REPOSITORY,
  IDocumentWriteRepository,
} from '@contexts/documents/domain/repositories/write/document-write.repository';
import {
  DOCUMENT_PROCESSING_QUEUE_PORT,
  IDocumentProcessingQueuePort,
} from '@contexts/documents/application/ports/document-processing-queue.port';
import { DocumentsConfig } from '@contexts/documents/infrastructure/config/documents.config';

import { CreateDocumentCommand } from './create-document.command';

export interface CreateDocumentResult {
  id: string;
  status: string;
}

@CommandHandler(CreateDocumentCommand)
export class CreateDocumentCommandHandler
  extends BaseCommandHandler<CreateDocumentCommand, DocumentAggregate>
  implements ICommandHandler<CreateDocumentCommand, CreateDocumentResult>
{
  private readonly logger = new Logger(CreateDocumentCommandHandler.name);
  private readonly maxContentLength: number;

  constructor(
    @Inject(DOCUMENT_WRITE_REPOSITORY)
    private readonly writeRepository: IDocumentWriteRepository,
    private readonly builder: DocumentBuilder,
    @Inject(DOCUMENT_PROCESSING_QUEUE_PORT)
    private readonly processingQueue: IDocumentProcessingQueuePort,
    configService: ConfigService,
    eventBus: EventBus,
  ) {
    super(eventBus);
    this.maxContentLength =
      configService.getOrThrow<DocumentsConfig>('documents').maxContentLength;
  }

  async execute(command: CreateDocumentCommand): Promise<CreateDocumentResult> {
    if (command.content.value.length > this.maxContentLength) {
      throw new DocumentContentTooLargeException(
        command.content.value.length,
        this.maxContentLength,
      );
    }

    const now = new Date();
    const id = UuidValueObject.generate().value;

    const document = this.builder
      .withId(id)
      .withKnowledgeBaseId(command.knowledgeBaseId.value)
      .withTitle(command.title.value)
      .withContent(command.content.value)
      .withCreatedAt(now)
      .withUpdatedAt(now)
      .build();

    document.create();

    await this.writeRepository.save(document);
    await this.publishEvents(document);

    await this.processingQueue.enqueueChunking(
      document.id.value,
      document.knowledgeBaseId.value,
    );

    this.logger.log(`Document created: ${document.id.value}`);

    return { id: document.id.value, status: document.status.value };
  }
}
