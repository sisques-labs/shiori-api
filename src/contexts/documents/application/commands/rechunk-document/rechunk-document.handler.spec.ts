import { EventBus } from '@nestjs/cqrs';
import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentInvalidStatusTransitionException } from '@contexts/documents/domain/exceptions/document-invalid-status-transition.exception';
import { DocumentChunkCountValueObject } from '@contexts/documents/domain/value-objects/document-chunk-count/document-chunk-count.value-object';
import { DocumentContentValueObject } from '@contexts/documents/domain/value-objects/document-content/document-content.value-object';
import { DocumentFailureReasonValueObject } from '@contexts/documents/domain/value-objects/document-failure-reason/document-failure-reason.value-object';
import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';
import { DocumentStatusValueObject } from '@contexts/documents/domain/value-objects/document-status/document-status.value-object';
import { DocumentTitleValueObject } from '@contexts/documents/domain/value-objects/document-title/document-title.value-object';
import { IDocumentWriteRepository } from '@contexts/documents/domain/repositories/write/document-write.repository';
import { IChunkWriteRepository } from '@contexts/documents/domain/repositories/write/chunk-write.repository';
import { AssertDocumentExistsService } from '@contexts/documents/application/services/write/assert-document-exists/assert-document-exists.service';
import { IDocumentProcessingQueuePort } from '@contexts/documents/application/ports/document-processing-queue.port';

import { RechunkDocumentCommand } from './rechunk-document.command';
import { RechunkDocumentCommandHandler } from './rechunk-document.handler';

function buildDocument(
  status: DocumentStatusEnum = DocumentStatusEnum.CHUNKED,
  chunkCount = 13,
  failureReason: string | null = null,
): DocumentAggregate {
  const now = new Date();
  return new DocumentAggregate({
    id: DocumentIdValueObject.generate() as DocumentIdValueObject,
    knowledgeBaseId: UuidValueObject.generate(),
    title: new DocumentTitleValueObject('Doc'),
    content: new DocumentContentValueObject('Some content'),
    status: new DocumentStatusValueObject(status),
    failureReason: failureReason
      ? new DocumentFailureReasonValueObject(failureReason)
      : null,
    chunkCount: new DocumentChunkCountValueObject(chunkCount),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('RechunkDocumentCommandHandler', () => {
  let writeRepository: jest.Mocked<IDocumentWriteRepository>;
  let chunkWriteRepository: jest.Mocked<IChunkWriteRepository>;
  let assertExists: jest.Mocked<AssertDocumentExistsService>;
  let processingQueue: jest.Mocked<IDocumentProcessingQueuePort>;
  let eventBus: jest.Mocked<EventBus>;
  let handler: RechunkDocumentCommandHandler;
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
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    assertExists = { execute: jest.fn().mockResolvedValue(document) } as any;
    processingQueue = {
      enqueueChunking: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = { publish: jest.fn(), publishAll: jest.fn() } as any;

    handler = new RechunkDocumentCommandHandler(
      writeRepository,
      chunkWriteRepository,
      assertExists,
      processingQueue,
      eventBus,
    );
  });

  it('happy path: resets to PENDING, deletes stale chunks, saves, and re-enqueues chunking', async () => {
    const command = new RechunkDocumentCommand({ id: document.id.value });

    await handler.execute(command);

    expect(document.status.value).toBe(DocumentStatusEnum.PENDING);
    expect(document.chunkCount.value).toBe(0);
    expect(chunkWriteRepository.deleteByDocumentId).toHaveBeenCalledWith(
      document.id.value,
    );
    expect(writeRepository.save).toHaveBeenCalledWith(document);
    expect(processingQueue.enqueueChunking).toHaveBeenCalledWith(
      document.id.value,
      document.knowledgeBaseId.value,
    );
    expect(eventBus.publishAll).toHaveBeenCalled();
  });

  it('is retryable from FAILED', async () => {
    document = buildDocument(DocumentStatusEnum.FAILED, 0, 'boom');
    assertExists.execute.mockResolvedValue(document);
    const command = new RechunkDocumentCommand({ id: document.id.value });

    await handler.execute(command);

    expect(document.status.value).toBe(DocumentStatusEnum.PENDING);
    expect(document.failureReason).toBeNull();
    expect(writeRepository.save).toHaveBeenCalledWith(document);
  });

  it('rejects while CHUNKING without deleting chunks or saving', async () => {
    document = buildDocument(DocumentStatusEnum.CHUNKING, 0);
    assertExists.execute.mockResolvedValue(document);
    const command = new RechunkDocumentCommand({ id: document.id.value });

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      DocumentInvalidStatusTransitionException,
    );
    expect(chunkWriteRepository.deleteByDocumentId).not.toHaveBeenCalled();
    expect(writeRepository.save).not.toHaveBeenCalled();
    expect(processingQueue.enqueueChunking).not.toHaveBeenCalled();
  });
});
