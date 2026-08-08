import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { IEmbeddingReembedQueuePort } from '@contexts/embeddings/application/ports/embedding-reembed-queue.port';
import { KnowledgeBaseReembeddingRequestedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-reembedding-requested/knowledge-base-reembedding-requested.event';

import { KnowledgeBaseReembeddingRequestedListener } from './knowledge-base-reembedding-requested.listener';

describe('KnowledgeBaseReembeddingRequestedListener', () => {
  it('enqueues a re-embed job with the same model as both previousModel and newModel', async () => {
    const reembedQueue: jest.Mocked<IEmbeddingReembedQueuePort> = {
      enqueueReembed: jest.fn().mockResolvedValue(undefined),
    };
    const listener = new KnowledgeBaseReembeddingRequestedListener(
      reembedQueue,
    );
    const knowledgeBaseId = UuidValueObject.generate().value;

    const event = new KnowledgeBaseReembeddingRequestedEvent(
      {
        aggregateRootId: knowledgeBaseId,
        aggregateRootType: 'KnowledgeBaseAggregate',
        entityId: knowledgeBaseId,
        entityType: 'KnowledgeBaseAggregate',
        eventType: 'KnowledgeBaseReembeddingRequestedEvent',
      },
      {
        knowledgeBaseId,
        model: 'text-embedding-3-small',
      },
    );

    await listener.handle(event);

    expect(reembedQueue.enqueueReembed).toHaveBeenCalledWith(
      knowledgeBaseId,
      'text-embedding-3-small',
      'text-embedding-3-small',
    );
  });
});
