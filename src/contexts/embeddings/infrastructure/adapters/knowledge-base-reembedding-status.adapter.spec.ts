import { CommandBus } from '@nestjs/cqrs';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { CompleteKnowledgeBaseReembeddingCommand } from '@contexts/knowledge-bases/application/commands/complete-knowledge-base-reembedding/complete-knowledge-base-reembedding.command';
import { FailKnowledgeBaseReembeddingCommand } from '@contexts/knowledge-bases/application/commands/fail-knowledge-base-reembedding/fail-knowledge-base-reembedding.command';

import { KnowledgeBaseReembeddingStatusAdapter } from './knowledge-base-reembedding-status.adapter';

describe('KnowledgeBaseReembeddingStatusAdapter', () => {
  let commandBus: jest.Mocked<CommandBus>;
  let adapter: KnowledgeBaseReembeddingStatusAdapter;

  beforeEach(() => {
    commandBus = { execute: jest.fn() } as unknown as jest.Mocked<CommandBus>;
    adapter = new KnowledgeBaseReembeddingStatusAdapter(commandBus);
  });

  it('complete() dispatches CompleteKnowledgeBaseReembeddingCommand', async () => {
    const knowledgeBaseId = UuidValueObject.generate().value;

    await adapter.complete(knowledgeBaseId);

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(CompleteKnowledgeBaseReembeddingCommand),
    );
    const dispatched = commandBus.execute.mock
      .calls[0][0] as CompleteKnowledgeBaseReembeddingCommand;
    expect(dispatched.id.value).toBe(knowledgeBaseId);
  });

  it('fail() dispatches FailKnowledgeBaseReembeddingCommand with the reason', async () => {
    const knowledgeBaseId = UuidValueObject.generate().value;

    await adapter.fail(knowledgeBaseId, 'provider timeout');

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(FailKnowledgeBaseReembeddingCommand),
    );
    const dispatched = commandBus.execute.mock
      .calls[0][0] as FailKnowledgeBaseReembeddingCommand;
    expect(dispatched.id.value).toBe(knowledgeBaseId);
    expect(dispatched.reason.value).toBe('provider timeout');
  });
});
