import { Queue } from 'bullmq';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import {
  BullmqEmbeddingProcessingQueueService,
  EMBED_DOCUMENT_CHUNKS_JOB_NAME,
} from './bullmq-embedding-processing-queue.service';

describe('BullmqEmbeddingProcessingQueueService', () => {
  let queue: jest.Mocked<Queue>;
  let service: BullmqEmbeddingProcessingQueueService;

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue(undefined) } as any;
    service = new BullmqEmbeddingProcessingQueueService(queue);
  });

  it('enqueues an embed-document-chunks job with the document and knowledge base ids', async () => {
    const documentId = UuidValueObject.generate().value;
    const knowledgeBaseId = UuidValueObject.generate().value;

    await service.enqueueEmbedding(documentId, knowledgeBaseId);

    expect(queue.add).toHaveBeenCalledWith(EMBED_DOCUMENT_CHUNKS_JOB_NAME, {
      documentId,
      knowledgeBaseId,
    });
  });
});
