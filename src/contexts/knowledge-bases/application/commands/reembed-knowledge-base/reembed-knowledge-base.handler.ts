import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import {
  KNOWLEDGE_BASE_WRITE_REPOSITORY,
  IKnowledgeBaseWriteRepository,
} from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import { AssertKnowledgeBaseNotReembeddingService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-not-reembedding/assert-knowledge-base-not-reembedding.service';

import { ReembedKnowledgeBaseCommand } from './reembed-knowledge-base.command';

@CommandHandler(ReembedKnowledgeBaseCommand)
export class ReembedKnowledgeBaseCommandHandler
  extends BaseCommandHandler<
    ReembedKnowledgeBaseCommand,
    KnowledgeBaseAggregate
  >
  implements ICommandHandler<ReembedKnowledgeBaseCommand, void>
{
  private readonly logger = new Logger(ReembedKnowledgeBaseCommandHandler.name);

  constructor(
    @Inject(KNOWLEDGE_BASE_WRITE_REPOSITORY)
    private readonly writeRepository: IKnowledgeBaseWriteRepository,
    private readonly assertExists: AssertKnowledgeBaseExistsService,
    private readonly assertNotReembedding: AssertKnowledgeBaseNotReembeddingService,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: ReembedKnowledgeBaseCommand): Promise<void> {
    const knowledgeBase = await this.assertExists.execute(command.id);

    this.assertNotReembedding.execute(knowledgeBase);

    knowledgeBase.requestReembedding();

    await this.writeRepository.save(knowledgeBase);
    await this.publishEvents(knowledgeBase);

    this.logger.log(`Reembedding requested: ${command.id.value}`);
  }
}
