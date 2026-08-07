import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';

import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DocumentBuilder } from '@contexts/documents/domain/builders/document.builder';
import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentContentTooLargeException } from '@contexts/documents/domain/exceptions/document-content-too-large.exception';
import { IDocumentWriteRepository } from '@contexts/documents/domain/repositories/write/document-write.repository';
import { IDocumentProcessingQueuePort } from '@contexts/documents/application/ports/document-processing-queue.port';
import { AssertDocumentContentNotTooLargeService } from '@contexts/documents/application/services/write/assert-document-content-not-too-large/assert-document-content-not-too-large.service';

import { CreateDocumentCommand } from './create-document.command';
import { CreateDocumentCommandHandler } from './create-document.handler';

function buildAssertContentNotTooLarge(
  maxContentLength = 500000,
): AssertDocumentContentNotTooLargeService {
  const configService = {
    getOrThrow: jest
      .fn()
      .mockReturnValue({ maxContentLength, maxChunks: 2000 }),
  } as unknown as ConfigService;
  return new AssertDocumentContentNotTooLargeService(configService);
}

describe('CreateDocumentCommandHandler', () => {
  let writeRepository: jest.Mocked<IDocumentWriteRepository>;
  let processingQueue: jest.Mocked<IDocumentProcessingQueuePort>;
  let eventBus: jest.Mocked<EventBus>;
  let handler: CreateDocumentCommandHandler;

  beforeEach(() => {
    writeRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
    processingQueue = {
      enqueueChunking: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = { publish: jest.fn(), publishAll: jest.fn() } as any;

    handler = new CreateDocumentCommandHandler(
      writeRepository,
      new DocumentBuilder(),
      processingQueue,
      buildAssertContentNotTooLarge(),
      eventBus,
    );
  });

  it('builds a PENDING document, saves it, publishes events, enqueues chunking, and returns id/status', async () => {
    const command = new CreateDocumentCommand({
      knowledgeBaseId: UuidValueObject.generate().value,
      title: 'My Doc',
      content: 'Some content',
    });

    const result = await handler.execute(command);

    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    const savedDocument = writeRepository.save.mock.calls[0][0];
    expect(savedDocument.status.value).toBe(DocumentStatusEnum.PENDING);
    expect(savedDocument.title.value).toBe('My Doc');
    expect(savedDocument.content.value).toBe('Some content');

    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);

    expect(processingQueue.enqueueChunking).toHaveBeenCalledWith(
      savedDocument.id.value,
      savedDocument.knowledgeBaseId.value,
    );

    expect(result).toEqual({
      id: savedDocument.id.value,
      status: DocumentStatusEnum.PENDING,
    });
  });

  it('rejects content exceeding maxContentLength without saving', async () => {
    handler = new CreateDocumentCommandHandler(
      writeRepository,
      new DocumentBuilder(),
      processingQueue,
      buildAssertContentNotTooLarge(10),
      eventBus,
    );

    const command = new CreateDocumentCommand({
      knowledgeBaseId: UuidValueObject.generate().value,
      title: 'My Doc',
      content: 'This content is way longer than ten characters',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      DocumentContentTooLargeException,
    );
    expect(writeRepository.save).not.toHaveBeenCalled();
    expect(processingQueue.enqueueChunking).not.toHaveBeenCalled();
  });
});
