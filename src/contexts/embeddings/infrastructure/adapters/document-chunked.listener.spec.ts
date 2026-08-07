import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DocumentChunkedEvent } from '@contexts/documents/domain/events/document-chunked/document-chunked.event';
import { IEmbeddingProcessingQueuePort } from '@contexts/embeddings/application/ports/embedding-processing-queue.port';

import { DocumentChunkedListener } from './document-chunked.listener';

describe('DocumentChunkedListener', () => {
  let processingQueue: jest.Mocked<IEmbeddingProcessingQueuePort>;
  let listener: DocumentChunkedListener;

  beforeEach(() => {
    processingQueue = {
      enqueueEmbedding: jest.fn().mockResolvedValue(undefined),
    };

    listener = new DocumentChunkedListener(processingQueue);
  });

  it('enqueues an embedding job for the chunked document, with no tenancy wrapping', async () => {
    const documentId = UuidValueObject.generate().value;
    const knowledgeBaseId = UuidValueObject.generate().value;
    const event = new DocumentChunkedEvent(
      {
        aggregateRootId: documentId,
        aggregateRootType: 'DocumentAggregate',
        entityId: documentId,
        entityType: 'DocumentAggregate',
        eventType: 'DocumentChunkedEvent',
      },
      {
        id: documentId,
        knowledgeBaseId,
        title: 'Doc',
        content: 'Content',
        status: 'CHUNKED',
        failureReason: null,
        chunkCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    await listener.handle(event);

    expect(processingQueue.enqueueEmbedding).toHaveBeenCalledWith(
      documentId,
      knowledgeBaseId,
    );
  });
});
