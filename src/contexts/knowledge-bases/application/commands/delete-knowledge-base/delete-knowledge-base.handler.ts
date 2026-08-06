import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import {
  KNOWLEDGE_BASE_WRITE_REPOSITORY,
  IKnowledgeBaseWriteRepository,
} from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';

import { DeleteKnowledgeBaseCommand } from './delete-knowledge-base.command';

@CommandHandler(DeleteKnowledgeBaseCommand)
export class DeleteKnowledgeBaseCommandHandler
  extends BaseCommandHandler<DeleteKnowledgeBaseCommand, KnowledgeBaseAggregate>
  implements ICommandHandler<DeleteKnowledgeBaseCommand, void>
{
  private readonly logger = new Logger(DeleteKnowledgeBaseCommandHandler.name);

  constructor(
    @Inject(KNOWLEDGE_BASE_WRITE_REPOSITORY)
    private readonly writeRepository: IKnowledgeBaseWriteRepository,
    private readonly assertExists: AssertKnowledgeBaseExistsService,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: DeleteKnowledgeBaseCommand): Promise<void> {
    const kb = await this.assertExists.execute(command.id);

    kb.delete();

    await this.writeRepository.delete(kb.id.value);
    await this.publishEvents(kb);

    this.logger.log(`KnowledgeBase deleted: ${command.id.value}`);
  }
}
