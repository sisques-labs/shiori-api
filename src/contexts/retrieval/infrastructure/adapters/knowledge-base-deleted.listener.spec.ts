import { CommandBus } from '@nestjs/cqrs';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DeleteEmbeddingsByKnowledgeBaseCommand } from '@contexts/retrieval/application/commands/delete-embeddings-by-knowledge-base/delete-embeddings-by-knowledge-base.command';
import { KnowledgeBaseDeletedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-deleted/knowledge-base-deleted.event';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

import { KnowledgeBaseDeletedListener } from './knowledge-base-deleted.listener';

describe('KnowledgeBaseDeletedListener (retrieval)', () => {
  let commandBus: jest.Mocked<CommandBus>;
  let knowledgeBaseContext: jest.Mocked<KnowledgeBaseContext>;
  let listener: KnowledgeBaseDeletedListener;

  beforeEach(() => {
    commandBus = { execute: jest.fn().mockResolvedValue(undefined) } as any;
    knowledgeBaseContext = {
      run: jest.fn((_id: string, fn: () => unknown) => fn()),
      get: jest.fn(),
      require: jest.fn(),
    } as any;

    listener = new KnowledgeBaseDeletedListener(
      commandBus,
      knowledgeBaseContext,
    );
  });

  it('runs inside the tenant context for the deleted knowledge base and dispatches the cascade command', async () => {
    const knowledgeBaseId = UuidValueObject.generate().value;
    const event = new KnowledgeBaseDeletedEvent(
      {
        aggregateRootId: knowledgeBaseId,
        aggregateRootType: 'KnowledgeBaseAggregate',
        entityId: knowledgeBaseId,
        entityType: 'KnowledgeBaseAggregate',
        eventType: 'KnowledgeBaseDeletedEvent',
      },
      { id: knowledgeBaseId, name: 'Docs' },
    );

    await listener.handle(event);

    expect(knowledgeBaseContext.run).toHaveBeenCalledWith(
      knowledgeBaseId,
      expect.any(Function),
    );

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const dispatchedCommand = commandBus.execute.mock
      .calls[0][0] as DeleteEmbeddingsByKnowledgeBaseCommand;
    expect(dispatchedCommand).toBeInstanceOf(
      DeleteEmbeddingsByKnowledgeBaseCommand,
    );
    expect(dispatchedCommand.knowledgeBaseId).toBe(knowledgeBaseId);
  });
});
