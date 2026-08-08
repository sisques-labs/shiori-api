import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import {
  KNOWLEDGE_BASE_WRITE_REPOSITORY,
  IKnowledgeBaseWriteRepository,
} from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { AssertEmbeddingModelIsValidService } from '@contexts/knowledge-bases/application/services/write/assert-embedding-model-is-valid/assert-embedding-model-is-valid.service';
import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import { AssertKnowledgeBaseNotReembeddingService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-not-reembedding/assert-knowledge-base-not-reembedding.service';
import { IsKnowledgeBaseEmbeddingModelUnchangedService } from '@contexts/knowledge-bases/application/services/write/is-knowledge-base-embedding-model-unchanged/is-knowledge-base-embedding-model-unchanged.service';

import { ChangeKnowledgeBaseEmbeddingModelCommand } from './change-knowledge-base-embedding-model.command';

@CommandHandler(ChangeKnowledgeBaseEmbeddingModelCommand)
export class ChangeKnowledgeBaseEmbeddingModelCommandHandler
  extends BaseCommandHandler<
    ChangeKnowledgeBaseEmbeddingModelCommand,
    KnowledgeBaseAggregate
  >
  implements ICommandHandler<ChangeKnowledgeBaseEmbeddingModelCommand, void>
{
  private readonly logger = new Logger(
    ChangeKnowledgeBaseEmbeddingModelCommandHandler.name,
  );

  constructor(
    @Inject(KNOWLEDGE_BASE_WRITE_REPOSITORY)
    private readonly writeRepository: IKnowledgeBaseWriteRepository,
    private readonly assertExists: AssertKnowledgeBaseExistsService,
    private readonly assertEmbeddingModelIsValid: AssertEmbeddingModelIsValidService,
    private readonly isEmbeddingModelUnchanged: IsKnowledgeBaseEmbeddingModelUnchangedService,
    private readonly assertNotReembedding: AssertKnowledgeBaseNotReembeddingService,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(
    command: ChangeKnowledgeBaseEmbeddingModelCommand,
  ): Promise<void> {
    const knowledgeBase = await this.assertExists.execute(command.id);

    await this.assertEmbeddingModelIsValid.execute(
      command.embeddingModel.value,
    );

    // No-op check comes BEFORE the re-embedding-in-progress check — calling
    // this with the Knowledge Base's current model is always idempotent
    // and side-effect-free, even mid-re-embed.
    if (
      this.isEmbeddingModelUnchanged.execute(
        knowledgeBase,
        command.embeddingModel,
      )
    ) {
      this.logger.log(
        `KnowledgeBase embedding model unchanged (no-op): ${command.id.value}`,
      );
      return;
    }

    this.assertNotReembedding.execute(knowledgeBase);

    knowledgeBase.changeEmbeddingModel(command.embeddingModel);

    await this.writeRepository.save(knowledgeBase);
    await this.publishEvents(knowledgeBase);

    this.logger.log(
      `KnowledgeBase embedding model change requested: ${command.id.value} -> ${command.embeddingModel.value}`,
    );
  }
}
