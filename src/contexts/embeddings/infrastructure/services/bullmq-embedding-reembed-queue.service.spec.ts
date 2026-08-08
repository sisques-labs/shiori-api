import { Queue } from 'bullmq';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import {
  BullmqEmbeddingReembedQueueService,
  REEMBED_KNOWLEDGE_BASE_JOB_NAME,
} from './bullmq-embedding-reembed-queue.service';

describe('BullmqEmbeddingReembedQueueService', () => {
  let queue: jest.Mocked<Queue>;
  let service: BullmqEmbeddingReembedQueueService;

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue(undefined) } as any;
    service = new BullmqEmbeddingReembedQueueService(queue);
  });

  it('enqueues a reembed-knowledge-base job with the knowledge base id and both models', async () => {
    const knowledgeBaseId = UuidValueObject.generate().value;

    await service.enqueueReembed(
      knowledgeBaseId,
      'text-embedding-3-small',
      'nomic-embed-text',
    );

    expect(queue.add).toHaveBeenCalledWith(REEMBED_KNOWLEDGE_BASE_JOB_NAME, {
      knowledgeBaseId,
      previousModel: 'text-embedding-3-small',
      newModel: 'nomic-embed-text',
    });
  });
});
