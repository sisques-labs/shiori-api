import { Queue } from 'bullmq';

import {
  BullmqDocumentProcessingQueueService,
  CHUNK_DOCUMENT_JOB_NAME,
} from './bullmq-document-processing-queue.service';

describe('BullmqDocumentProcessingQueueService', () => {
  let queue: jest.Mocked<Queue>;
  let service: BullmqDocumentProcessingQueueService;

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue(undefined) } as any;
    service = new BullmqDocumentProcessingQueueService(queue);
  });

  it('enqueues a chunk-document job with the document and knowledge base ids', async () => {
    await service.enqueueChunking('doc-1', 'kb-1');

    expect(queue.add).toHaveBeenCalledWith(CHUNK_DOCUMENT_JOB_NAME, {
      documentId: 'doc-1',
      knowledgeBaseId: 'kb-1',
    });
  });
});
