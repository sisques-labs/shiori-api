import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import {
  KNOWLEDGE_BASE_WRITE_REPOSITORY,
  IKnowledgeBaseWriteRepository,
} from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';

import { FailKnowledgeBaseReembeddingCommand } from './fail-knowledge-base-reembedding.command';

@CommandHandler(FailKnowledgeBaseReembeddingCommand)
export class FailKnowledgeBaseReembeddingCommandHandler
  extends BaseCommandHandler<
    FailKnowledgeBaseReembeddingCommand,
    KnowledgeBaseAggregate
  >
  implements ICommandHandler<FailKnowledgeBaseReembeddingCommand, void>
{
  private readonly logger = new Logger(
    FailKnowledgeBaseReembeddingCommandHandler.name,
  );

  constructor(
    @Inject(KNOWLEDGE_BASE_WRITE_REPOSITORY)
    private readonly writeRepository: IKnowledgeBaseWriteRepository,
    private readonly assertExists: AssertKnowledgeBaseExistsService,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: FailKnowledgeBaseReembeddingCommand): Promise<void> {
    const knowledgeBase = await this.assertExists.execute(command.id);

    knowledgeBase.failReembedding(command.reason.value);

    await this.writeRepository.save(knowledgeBase);
    await this.publishEvents(knowledgeBase);

    this.logger.log(
      `KnowledgeBase re-embedding failed: ${command.id.value} (${command.reason.value})`,
    );
  }
}
