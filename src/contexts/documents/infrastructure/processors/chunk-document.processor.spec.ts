import { EventBus } from '@nestjs/cqrs';
import { Job } from 'bullmq';
import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { ChunkBuilder } from '@contexts/documents/domain/builders/chunk.builder';
import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentChunkCountValueObject } from '@contexts/documents/domain/value-objects/document-chunk-count/document-chunk-count.value-object';
import { DocumentContentValueObject } from '@contexts/documents/domain/value-objects/document-content/document-content.value-object';
import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';
import { DocumentStatusValueObject } from '@contexts/documents/domain/value-objects/document-status/document-status.value-object';
import { DocumentTitleValueObject } from '@contexts/documents/domain/value-objects/document-title/document-title.value-object';
import { IDocumentWriteRepository } from '@contexts/documents/domain/repositories/write/document-write.repository';
import { IChunkWriteRepository } from '@contexts/documents/domain/repositories/write/chunk-write.repository';
import { IChunkingStrategyPort } from '@contexts/documents/application/ports/chunking-strategy.port';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

import {
  ChunkDocumentJobData,
  ChunkDocumentProcessor,
} from './chunk-document.processor';

function buildDocument(): DocumentAggregate {
  const now = new Date();
  return new DocumentAggregate({
    id: DocumentIdValueObject.generate() as DocumentIdValueObject,
    knowledgeBaseId: UuidValueObject.generate(),
    title: new DocumentTitleValueObject('Doc'),
    content: new DocumentContentValueObject('Some content to chunk'),
    status: new DocumentStatusValueObject(DocumentStatusEnum.PENDING),
    failureReason: null,
    chunkCount: new DocumentChunkCountValueObject(0),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('ChunkDocumentProcessor', () => {
  let documentWriteRepository: jest.Mocked<IDocumentWriteRepository>;
  let chunkWriteRepository: jest.Mocked<IChunkWriteRepository>;
  let chunkingStrategy: jest.Mocked<IChunkingStrategyPort>;
  let knowledgeBaseContext: jest.Mocked<KnowledgeBaseContext>;
  let eventBus: jest.Mocked<EventBus>;
  let processor: ChunkDocumentProcessor;
  let document: DocumentAggregate;

  beforeEach(() => {
    document = buildDocument();

    documentWriteRepository = {
      findById: jest.fn().mockResolvedValue(document),
      findByCriteria: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
    chunkWriteRepository = {
      saveMany: jest.fn().mockResolvedValue(undefined),
      deleteByDocumentId: jest.fn(),
      findByDocumentId: jest.fn(),
    };
    chunkingStrategy = {
      chunk: jest.fn(),
    };
    knowledgeBaseContext = {
      run: jest.fn((_id: string, fn: () => unknown) => fn()),
      get: jest.fn(),
      require: jest.fn(),
    } as any;
    eventBus = { publish: jest.fn(), publishAll: jest.fn() } as any;

    processor = new ChunkDocumentProcessor(
      documentWriteRepository,
      chunkWriteRepository,
      chunkingStrategy,
      new ChunkBuilder(),
      knowledgeBaseContext,
      eventBus,
    );
  });

  function buildJob(): Job<ChunkDocumentJobData> {
    return {
      data: {
        documentId: document.id.value,
        knowledgeBaseId: document.knowledgeBaseId.value,
      },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as unknown as Job<ChunkDocumentJobData>;
  }

  it('chunks the document, saves the chunks, and persists the CHUNKED status', async () => {
    chunkingStrategy.chunk.mockReturnValue([
      { text: 'a', position: 0 },
      { text: 'b', position: 1 },
    ]);

    const job = buildJob();

    await processor.process(job);

    expect(knowledgeBaseContext.run).toHaveBeenCalledWith(
      job.data.knowledgeBaseId,
      expect.any(Function),
    );

    expect(chunkWriteRepository.saveMany).toHaveBeenCalledTimes(1);
    const savedChunks = chunkWriteRepository.saveMany.mock.calls[0][0];
    expect(savedChunks).toHaveLength(2);

    const finalSaveCall =
      documentWriteRepository.save.mock.calls[
        documentWriteRepository.save.mock.calls.length - 1
      ];
    const persistedDocument = finalSaveCall[0];
    expect(persistedDocument.status.value).toBe(DocumentStatusEnum.CHUNKED);
    expect(persistedDocument.chunkCount.value).toBe(2);
  });

  it('marks the document FAILED and re-throws when the chunking strategy throws', async () => {
    const error = new Error('chunking blew up');
    chunkingStrategy.chunk.mockImplementation(() => {
      throw error;
    });

    const job = buildJob();

    await expect(processor.process(job)).rejects.toThrow(error);

    const finalSaveCall =
      documentWriteRepository.save.mock.calls[
        documentWriteRepository.save.mock.calls.length - 1
      ];
    const persistedDocument = finalSaveCall[0];
    expect(persistedDocument.status.value).toBe(DocumentStatusEnum.FAILED);
    expect(persistedDocument.failureReason?.value).toBe('chunking blew up');

    expect(chunkWriteRepository.saveMany).not.toHaveBeenCalled();
  });
});
