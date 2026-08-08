import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseEmbeddingStatusEnum } from '@contexts/knowledge-bases/domain/enums/knowledge-base-embedding-status.enum';
import { InvalidEmbeddingModelException } from '@contexts/knowledge-bases/domain/exceptions/invalid-embedding-model.exception';
import { KnowledgeBaseReembeddingInProgressException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-reembedding-in-progress.exception';
import {
  KNOWLEDGE_BASE_WRITE_REPOSITORY,
  IKnowledgeBaseWriteRepository,
} from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import {
  EMBEDDING_MODEL_VALIDATION_PORT,
  IEmbeddingModelValidationPort,
} from '@contexts/knowledge-bases/application/ports/embedding-model-validation.port';

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
    @Inject(EMBEDDING_MODEL_VALIDATION_PORT)
    private readonly embeddingModelValidation: IEmbeddingModelValidationPort,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(
    command: ChangeKnowledgeBaseEmbeddingModelCommand,
  ): Promise<void> {
    const knowledgeBase = await this.assertExists.execute(command.id);

    const isValidModel = await this.embeddingModelValidation.isValid(
      command.embeddingModel.value,
    );
    if (!isValidModel) {
      throw new InvalidEmbeddingModelException(command.embeddingModel.value);
    }

    // No-op check comes BEFORE the re-embedding-in-progress check — calling
    // this with the Knowledge Base's current model is always idempotent
    // and side-effect-free, even mid-re-embed.
    if (knowledgeBase.embeddingModel.equals(command.embeddingModel)) {
      this.logger.log(
        `KnowledgeBase embedding model unchanged (no-op): ${command.id.value}`,
      );
      return;
    }

    if (
      knowledgeBase.embeddingStatus.value ===
      KnowledgeBaseEmbeddingStatusEnum.REEMBEDDING
    ) {
      throw new KnowledgeBaseReembeddingInProgressException(command.id.value);
    }

    knowledgeBase.changeEmbeddingModel(command.embeddingModel);

    await this.writeRepository.save(knowledgeBase);
    await this.publishEvents(knowledgeBase);

    this.logger.log(
      `KnowledgeBase embedding model change requested: ${command.id.value} -> ${command.embeddingModel.value}`,
    );
  }
}
