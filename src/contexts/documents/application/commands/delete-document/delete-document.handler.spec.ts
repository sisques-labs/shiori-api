import { EventBus } from '@nestjs/cqrs';
import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentChunkCountValueObject } from '@contexts/documents/domain/value-objects/document-chunk-count/document-chunk-count.value-object';
import { DocumentContentValueObject } from '@contexts/documents/domain/value-objects/document-content/document-content.value-object';
import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';
import { DocumentStatusValueObject } from '@contexts/documents/domain/value-objects/document-status/document-status.value-object';
import { DocumentTitleValueObject } from '@contexts/documents/domain/value-objects/document-title/document-title.value-object';
import { IDocumentWriteRepository } from '@contexts/documents/domain/repositories/write/document-write.repository';
import { IChunkWriteRepository } from '@contexts/documents/domain/repositories/write/chunk-write.repository';
import { AssertDocumentExistsService } from '@contexts/documents/application/services/write/assert-document-exists/assert-document-exists.service';

import { DeleteDocumentCommand } from './delete-document.command';
import { DeleteDocumentCommandHandler } from './delete-document.handler';

describe('DeleteDocumentCommandHandler', () => {
  let writeRepository: jest.Mocked<IDocumentWriteRepository>;
  let chunkWriteRepository: jest.Mocked<IChunkWriteRepository>;
  let assertExists: jest.Mocked<AssertDocumentExistsService>;
  let eventBus: jest.Mocked<EventBus>;
  let handler: DeleteDocumentCommandHandler;
  let document: DocumentAggregate;

  beforeEach(() => {
    const now = new Date();
    document = new DocumentAggregate({
      id: DocumentIdValueObject.generate() as DocumentIdValueObject,
      knowledgeBaseId: UuidValueObject.generate(),
      title: new DocumentTitleValueObject('Doc'),
      content: new DocumentContentValueObject('Content'),
      status: new DocumentStatusValueObject(DocumentStatusEnum.CHUNKED),
      failureReason: null,
      chunkCount: new DocumentChunkCountValueObject(2),
      createdAt: new DateValueObject(now),
      updatedAt: new DateValueObject(now),
    });

    writeRepository = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
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
    eventBus = { publish: jest.fn(), publishAll: jest.fn() } as any;

    handler = new DeleteDocumentCommandHandler(
      writeRepository,
      chunkWriteRepository,
      assertExists,
      eventBus,
    );
  });

  it('deletes chunks before the document and publishes events', async () => {
    const command = new DeleteDocumentCommand({ id: document.id.value });

    await handler.execute(command);

    expect(chunkWriteRepository.deleteByDocumentId).toHaveBeenCalledWith(
      document.id.value,
    );
    expect(writeRepository.delete).toHaveBeenCalledWith(document.id.value);

    const chunksDeletedOrder =
      chunkWriteRepository.deleteByDocumentId.mock.invocationCallOrder[0];
    const documentDeletedOrder =
      writeRepository.delete.mock.invocationCallOrder[0];
    expect(chunksDeletedOrder).toBeLessThan(documentDeletedOrder);

    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('propagates DocumentNotFoundException from the assert service', async () => {
    const error = new Error('not found');
    assertExists.execute.mockRejectedValue(error);

    const command = new DeleteDocumentCommand({ id: document.id.value });

    await expect(handler.execute(command)).rejects.toThrow(error);
    expect(chunkWriteRepository.deleteByDocumentId).not.toHaveBeenCalled();
    expect(writeRepository.delete).not.toHaveBeenCalled();
  });
});
