import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import {
  KNOWLEDGE_BASE_WRITE_REPOSITORY,
  IKnowledgeBaseWriteRepository,
} from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';

import { UpdateKnowledgeBaseCommand } from './update-knowledge-base.command';

@CommandHandler(UpdateKnowledgeBaseCommand)
export class UpdateKnowledgeBaseCommandHandler
  extends BaseCommandHandler<UpdateKnowledgeBaseCommand, KnowledgeBaseAggregate>
  implements ICommandHandler<UpdateKnowledgeBaseCommand, void>
{
  private readonly logger = new Logger(UpdateKnowledgeBaseCommandHandler.name);

  constructor(
    @Inject(KNOWLEDGE_BASE_WRITE_REPOSITORY)
    private readonly writeRepository: IKnowledgeBaseWriteRepository,
    private readonly assertExists: AssertKnowledgeBaseExistsService,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: UpdateKnowledgeBaseCommand): Promise<void> {
    const kb = await this.assertExists.execute(command.id);

    kb.update({ name: command.name, description: command.description });

    await this.writeRepository.save(kb);
    await this.publishEvents(kb);

    this.logger.log(`KnowledgeBase updated: ${command.id.value}`);
  }
}
