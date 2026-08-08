import { CommandBus } from '@nestjs/cqrs';

import { DeleteDocumentsByKnowledgeBaseCommand } from '@contexts/documents/application/commands/delete-documents-by-knowledge-base/delete-documents-by-knowledge-base.command';
import { KnowledgeBaseDeletedEvent } from '@contexts/knowledge-bases/domain/events/knowledge-base-deleted/knowledge-base-deleted.event';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

import { KnowledgeBaseDeletedListener } from './knowledge-base-deleted.listener';

describe('KnowledgeBaseDeletedListener', () => {
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
    const event = new KnowledgeBaseDeletedEvent(
      {
        aggregateRootId: 'kb-1',
        aggregateRootType: 'KnowledgeBaseAggregate',
        entityId: 'kb-1',
        entityType: 'KnowledgeBaseAggregate',
        eventType: 'KnowledgeBaseDeletedEvent',
      },
      {
        id: 'kb-1',
        name: 'Docs',
        description: null,
        embeddingModel: 'text-embedding-3-small',
        embeddingStatus: 'READY',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    await listener.handle(event);

    expect(knowledgeBaseContext.run).toHaveBeenCalledWith(
      'kb-1',
      expect.any(Function),
    );

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const dispatchedCommand = commandBus.execute.mock
      .calls[0][0] as DeleteDocumentsByKnowledgeBaseCommand;
    expect(dispatchedCommand).toBeInstanceOf(
      DeleteDocumentsByKnowledgeBaseCommand,
    );
    expect(dispatchedCommand.knowledgeBaseId).toBe('kb-1');
  });
});
