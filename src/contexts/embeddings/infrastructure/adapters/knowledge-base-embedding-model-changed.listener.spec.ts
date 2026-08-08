import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { IEmbeddingReembedQueuePort } from '@contexts/embeddings/application/ports/embedding-reembed-queue.port';
import { KnowledgeBaseEmbeddingModelChangeRequestedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-embedding-model-change-requested/knowledge-base-embedding-model-change-requested.event';

import { KnowledgeBaseEmbeddingModelChangedListener } from './knowledge-base-embedding-model-changed.listener';

describe('KnowledgeBaseEmbeddingModelChangedListener', () => {
  it('enqueues a re-embed job with the knowledge base id and both models', async () => {
    const reembedQueue: jest.Mocked<IEmbeddingReembedQueuePort> = {
      enqueueReembed: jest.fn().mockResolvedValue(undefined),
    };
    const listener = new KnowledgeBaseEmbeddingModelChangedListener(
      reembedQueue,
    );
    const knowledgeBaseId = UuidValueObject.generate().value;

    const event = new KnowledgeBaseEmbeddingModelChangeRequestedEvent(
      {
        aggregateRootId: knowledgeBaseId,
        aggregateRootType: 'KnowledgeBaseAggregate',
        entityId: knowledgeBaseId,
        entityType: 'KnowledgeBaseAggregate',
        eventType: 'KnowledgeBaseEmbeddingModelChangeRequestedEvent',
      },
      {
        knowledgeBaseId,
        previousModel: 'text-embedding-3-small',
        newModel: 'nomic-embed-text',
      },
    );

    await listener.handle(event);

    expect(reembedQueue.enqueueReembed).toHaveBeenCalledWith(
      knowledgeBaseId,
      'text-embedding-3-small',
      'nomic-embed-text',
    );
  });
});
