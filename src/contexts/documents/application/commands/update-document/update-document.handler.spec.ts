import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';
import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentContentTooLargeException } from '@contexts/documents/domain/exceptions/document-content-too-large.exception';
import { DocumentInvalidStatusTransitionException } from '@contexts/documents/domain/exceptions/document-invalid-status-transition.exception';
import { DocumentChunkCountValueObject } from '@contexts/documents/domain/value-objects/document-chunk-count/document-chunk-count.value-object';
import { DocumentContentValueObject } from '@contexts/documents/domain/value-objects/document-content/document-content.value-object';
import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';
import { DocumentStatusValueObject } from '@contexts/documents/domain/value-objects/document-status/document-status.value-object';
import { DocumentTitleValueObject } from '@contexts/documents/domain/value-objects/document-title/document-title.value-object';
import { IDocumentWriteRepository } from '@contexts/documents/domain/repositories/write/document-write.repository';
import { IChunkWriteRepository } from '@contexts/documents/domain/repositories/write/chunk-write.repository';
import { AssertDocumentExistsService } from '@contexts/documents/application/services/write/assert-document-exists/assert-document-exists.service';
import { AssertDocumentContentNotTooLargeService } from '@contexts/documents/application/services/write/assert-document-content-not-too-large/assert-document-content-not-too-large.service';
import { IDocumentProcessingQueuePort } from '@contexts/documents/application/ports/document-processing-queue.port';

import { UpdateDocumentCommand } from './update-document.command';
import { UpdateDocumentCommandHandler } from './update-document.handler';

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

function buildDocument(
  status: DocumentStatusEnum = DocumentStatusEnum.PENDING,
): DocumentAggregate {
  const now = new Date();
  return new DocumentAggregate({
    id: DocumentIdValueObject.generate() as DocumentIdValueObject,
    knowledgeBaseId: UuidValueObject.generate(),
    title: new DocumentTitleValueObject('Original title'),
    content: new DocumentContentValueObject('Original content'),
    status: new DocumentStatusValueObject(status),
    failureReason: null,
    chunkCount: new DocumentChunkCountValueObject(0),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('UpdateDocumentCommandHandler', () => {
  let writeRepository: jest.Mocked<IDocumentWriteRepository>;
  let chunkWriteRepository: jest.Mocked<IChunkWriteRepository>;
  let assertExists: jest.Mocked<AssertDocumentExistsService>;
  let processingQueue: jest.Mocked<IDocumentProcessingQueuePort>;
  let eventBus: jest.Mocked<EventBus>;
  let handler: UpdateDocumentCommandHandler;
  let document: DocumentAggregate;

  beforeEach(() => {
    document = buildDocument();

    writeRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
    chunkWriteRepository = {
      saveMany: jest.fn(),
      deleteByDocumentId: jest.fn().mockResolvedValue(undefined),
      findByDocumentId: jest.fn(),
    };
    assertExists = { execute: jest.fn().mockResolvedValue(document) } as any;
    processingQueue = {
      enqueueChunking: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = { publish: jest.fn(), publishAll: jest.fn() } as any;

    handler = new UpdateDocumentCommandHandler(
      writeRepository,
      chunkWriteRepository,
      assertExists,
      processingQueue,
      buildAssertContentNotTooLarge(),
      eventBus,
    );
  });

  it('replaces the title only: no chunk deletion, no re-enqueue', async () => {
    const command = new UpdateDocumentCommand({
      id: document.id.value,
      title: 'New title',
    });

    await handler.execute(command);

    expect(document.title.value).toBe('New title');
    expect(writeRepository.save).toHaveBeenCalledWith(document);
    expect(chunkWriteRepository.deleteByDocumentId).not.toHaveBeenCalled();
    expect(processingQueue.enqueueChunking).not.toHaveBeenCalled();
  });

  it('replaces the content: deletes existing chunks and re-enqueues chunking', async () => {
    const command = new UpdateDocumentCommand({
      id: document.id.value,
      content: 'New content',
    });

    await handler.execute(command);

    expect(document.content.value).toBe('New content');
    expect(chunkWriteRepository.deleteByDocumentId).toHaveBeenCalledWith(
      document.id.value,
    );
    expect(writeRepository.save).toHaveBeenCalledWith(document);
    expect(processingQueue.enqueueChunking).toHaveBeenCalledWith(
      document.id.value,
      document.knowledgeBaseId.value,
    );
  });

  it('rejects content exceeding maxContentLength without saving', async () => {
    handler = new UpdateDocumentCommandHandler(
      writeRepository,
      chunkWriteRepository,
      assertExists,
      processingQueue,
      buildAssertContentNotTooLarge(10),
      eventBus,
    );

    const command = new UpdateDocumentCommand({
      id: document.id.value,
      content: 'This content is way longer than ten characters',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      DocumentContentTooLargeException,
    );
    expect(writeRepository.save).not.toHaveBeenCalled();
    expect(chunkWriteRepository.deleteByDocumentId).not.toHaveBeenCalled();
    expect(processingQueue.enqueueChunking).not.toHaveBeenCalled();
  });

  it('propagates DocumentInvalidStatusTransitionException when the document is CHUNKING', async () => {
    const chunkingDocument = buildDocument(DocumentStatusEnum.CHUNKING);
    assertExists.execute.mockResolvedValue(chunkingDocument);

    const command = new UpdateDocumentCommand({
      id: chunkingDocument.id.value,
      title: 'New title',
    });

    await expect(handler.execute(command)).rejects.toThrow(
      DocumentInvalidStatusTransitionException,
    );
    expect(writeRepository.save).not.toHaveBeenCalled();
  });
});
