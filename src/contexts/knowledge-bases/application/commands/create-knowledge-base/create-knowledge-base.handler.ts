import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseBuilder } from '@contexts/knowledge-bases/domain/builders/knowledge-base.builder';
import { InvalidEmbeddingModelException } from '@contexts/knowledge-bases/domain/exceptions/invalid-embedding-model.exception';
import {
  KNOWLEDGE_BASE_WRITE_REPOSITORY,
  IKnowledgeBaseWriteRepository,
} from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { GenerateApiKeyService } from '@contexts/knowledge-bases/application/services/write/generate-api-key/generate-api-key.service';
import {
  EMBEDDING_MODEL_VALIDATION_PORT,
  IEmbeddingModelValidationPort,
} from '@contexts/knowledge-bases/application/ports/embedding-model-validation.port';
import {
  HASH_API_KEY_PORT,
  IHashApiKeyPort,
} from '@contexts/knowledge-bases/application/ports/hash-api-key.port';

import { CreateKnowledgeBaseCommand } from './create-knowledge-base.command';

export interface CreateKnowledgeBaseResult {
  id: string;
  apiKey: string;
}

@CommandHandler(CreateKnowledgeBaseCommand)
export class CreateKnowledgeBaseCommandHandler
  extends BaseCommandHandler<CreateKnowledgeBaseCommand, KnowledgeBaseAggregate>
  implements
    ICommandHandler<CreateKnowledgeBaseCommand, CreateKnowledgeBaseResult>
{
  private readonly logger = new Logger(CreateKnowledgeBaseCommandHandler.name);

  constructor(
    @Inject(KNOWLEDGE_BASE_WRITE_REPOSITORY)
    private readonly writeRepository: IKnowledgeBaseWriteRepository,
    private readonly builder: KnowledgeBaseBuilder,
    private readonly generateApiKey: GenerateApiKeyService,
    @Inject(HASH_API_KEY_PORT)
    private readonly hashApiKey: IHashApiKeyPort,
    @Inject(EMBEDDING_MODEL_VALIDATION_PORT)
    private readonly embeddingModelValidation: IEmbeddingModelValidationPort,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(
    command: CreateKnowledgeBaseCommand,
  ): Promise<CreateKnowledgeBaseResult> {
    const isValidModel = await this.embeddingModelValidation.isValid(
      command.embeddingModel.value,
    );
    if (!isValidModel) {
      throw new InvalidEmbeddingModelException(command.embeddingModel.value);
    }

    const now = new Date();
    const id = UuidValueObject.generate().value;
    const apiKey = await this.generateApiKey.execute();
    const apiKeyHash = await this.hashApiKey.hash(apiKey);

    const knowledgeBase = this.builder
      .withId(id)
      .withName(command.name.value)
      .withDescription(command.description?.value ?? null)
      .withApiKeyHash(apiKeyHash)
      .withEmbeddingModel(command.embeddingModel.value)
      .withCreatedAt(now)
      .withUpdatedAt(now)
      .build();

    knowledgeBase.create();

    await this.writeRepository.save(knowledgeBase);
    await this.publishEvents(knowledgeBase);

    this.logger.log(`KnowledgeBase created: ${knowledgeBase.id.value}`);

    return {
      id: knowledgeBase.id.value,
      apiKey,
    };
  }
}
