import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import {
  KNOWLEDGE_BASE_WRITE_REPOSITORY,
  IKnowledgeBaseWriteRepository,
} from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';

import { CompleteKnowledgeBaseReembeddingCommand } from './complete-knowledge-base-reembedding.command';

@CommandHandler(CompleteKnowledgeBaseReembeddingCommand)
export class CompleteKnowledgeBaseReembeddingCommandHandler
  extends BaseCommandHandler<
    CompleteKnowledgeBaseReembeddingCommand,
    KnowledgeBaseAggregate
  >
  implements ICommandHandler<CompleteKnowledgeBaseReembeddingCommand, void>
{
  private readonly logger = new Logger(
    CompleteKnowledgeBaseReembeddingCommandHandler.name,
  );

  constructor(
    @Inject(KNOWLEDGE_BASE_WRITE_REPOSITORY)
    private readonly writeRepository: IKnowledgeBaseWriteRepository,
    private readonly assertExists: AssertKnowledgeBaseExistsService,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(
    command: CompleteKnowledgeBaseReembeddingCommand,
  ): Promise<void> {
    const knowledgeBase = await this.assertExists.execute(command.id);

    knowledgeBase.completeReembedding();

    await this.writeRepository.save(knowledgeBase);
    await this.publishEvents(knowledgeBase);

    this.logger.log(
      `KnowledgeBase re-embedding completed: ${command.id.value}`,
    );
  }
}
