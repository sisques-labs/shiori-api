import { CommandBus } from '@nestjs/cqrs';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DeleteEmbeddingsByDocumentCommand } from '@contexts/retrieval/application/commands/delete-embeddings-by-document/delete-embeddings-by-document.command';
import { DocumentChunkingStartedEvent } from '@contexts/documents/domain/events/document-chunking-started/document-chunking-started.event';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

import { DocumentChunkingStartedListener } from './document-chunking-started.listener';

describe('DocumentChunkingStartedListener', () => {
  let commandBus: jest.Mocked<CommandBus>;
  let knowledgeBaseContext: jest.Mocked<KnowledgeBaseContext>;
  let listener: DocumentChunkingStartedListener;

  beforeEach(() => {
    commandBus = { execute: jest.fn().mockResolvedValue(undefined) } as any;
    knowledgeBaseContext = {
      run: jest.fn((_id: string, fn: () => unknown) => fn()),
      get: jest.fn(),
      require: jest.fn(),
    } as any;

    listener = new DocumentChunkingStartedListener(
      commandBus,
      knowledgeBaseContext,
    );
  });

  it('runs inside the tenant context and clears stale embeddings for the document', async () => {
    const documentId = UuidValueObject.generate().value;
    const knowledgeBaseId = UuidValueObject.generate().value;
    const event = new DocumentChunkingStartedEvent(
      {
        aggregateRootId: documentId,
        aggregateRootType: 'DocumentAggregate',
        entityId: documentId,
        entityType: 'DocumentAggregate',
        eventType: 'DocumentChunkingStartedEvent',
      },
      { id: documentId, knowledgeBaseId, status: 'CHUNKING' },
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
