import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { IKnowledgeBaseReembeddingStatusPort } from '@contexts/embeddings/application/ports/knowledge-base-reembedding-status.port';
import { CompleteKnowledgeBaseReembeddingCommand } from '@contexts/knowledge-bases/application/commands/complete-knowledge-base-reembedding/complete-knowledge-base-reembedding.command';
import { FailKnowledgeBaseReembeddingCommand } from '@contexts/knowledge-bases/application/commands/fail-knowledge-base-reembedding/fail-knowledge-base-reembedding.command';

/**
 * Implements `IKnowledgeBaseReembeddingStatusPort` by dispatching
 * `knowledge-bases`' internal completion/failure commands through the
 * global CommandBus — the established cross-context write seam in this
 * codebase (mirrors the cleanup listeners in this same directory, which
 * dispatch this context's own commands in reaction to another context's
 * events). `ReembedKnowledgeBaseProcessor` depends only on the port
 * (`application/ports/`), never on this adapter or on `knowledge-bases`'
 * command classes directly — that would violate the
 * `boundaries/element-types` ESLint rule outside `infrastructure/adapters/`.
 */
@Injectable()
export class KnowledgeBaseReembeddingStatusAdapter implements IKnowledgeBaseReembeddingStatusPort {
  constructor(private readonly commandBus: CommandBus) {}

  async complete(knowledgeBaseId: string): Promise<void> {
    await this.commandBus.execute(
      new CompleteKnowledgeBaseReembeddingCommand({ id: knowledgeBaseId }),
    );
  }

  async fail(knowledgeBaseId: string, reason: string): Promise<void> {
    await this.commandBus.execute(
      new FailKnowledgeBaseReembeddingCommand({ id: knowledgeBaseId, reason }),
    );
  }
}
