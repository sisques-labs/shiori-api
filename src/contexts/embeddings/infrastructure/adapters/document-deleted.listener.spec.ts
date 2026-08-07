import { CommandBus } from '@nestjs/cqrs';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DeleteEmbeddingsByDocumentCommand } from '@contexts/embeddings/application/commands/delete-embeddings-by-document/delete-embeddings-by-document.command';
import { DocumentDeletedEvent } from '@contexts/documents/domain/events/document-deleted/document-deleted.event';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

import { DocumentDeletedListener } from './document-deleted.listener';

describe('DocumentDeletedListener', () => {
  let commandBus: jest.Mocked<CommandBus>;
  let knowledgeBaseContext: jest.Mocked<KnowledgeBaseContext>;
  let listener: DocumentDeletedListener;

  beforeEach(() => {
    commandBus = { execute: jest.fn().mockResolvedValue(undefined) } as any;
    knowledgeBaseContext = {
      run: jest.fn((_id: string, fn: () => unknown) => fn()),
      get: jest.fn(),
      require: jest.fn(),
    } as any;

    listener = new DocumentDeletedListener(commandBus, knowledgeBaseContext);
  });

  it('runs inside the tenant context for the deleted document and dispatches the cascade command', async () => {
    const documentId = UuidValueObject.generate().value;
    const knowledgeBaseId = UuidValueObject.generate().value;
    const event = new DocumentDeletedEvent(
      {
        aggregateRootId: documentId,
        aggregateRootType: 'DocumentAggregate',
        entityId: documentId,
        entityType: 'DocumentAggregate',
        eventType: 'DocumentDeletedEvent',
      },
      { id: documentId, knowledgeBaseId, status: 'DELETED' },
    );

    await listener.handle(event);

    expect(knowledgeBaseContext.run).toHaveBeenCalledWith(
      knowledgeBaseId,
      expect.any(Function),
    );

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const dispatchedCommand = commandBus.execute.mock
      .calls[0][0] as DeleteEmbeddingsByDocumentCommand;
    expect(dispatchedCommand).toBeInstanceOf(DeleteEmbeddingsByDocumentCommand);
    expect(dispatchedCommand.documentId).toBe(documentId);
  });
});
