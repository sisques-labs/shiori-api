import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseBuilder } from '@contexts/knowledge-bases/domain/builders/knowledge-base.builder';
import {
  KNOWLEDGE_BASE_WRITE_REPOSITORY,
  IKnowledgeBaseWriteRepository,
} from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';
import { GenerateApiKeyService } from '@contexts/knowledge-bases/application/services/write/generate-api-key/generate-api-key.service';
import { HashApiKeyService } from '@core/tenancy/hash-api-key.service';

import { CreateKnowledgeBaseCommand } from './create-knowledge-base.command';

export interface CreateKnowledgeBaseResult {
  id: string;
  name: string;
  description: string | null;
  apiKey: string;
  createdAt: Date;
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
    private readonly hashApiKey: HashApiKeyService,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(
    command: CreateKnowledgeBaseCommand,
  ): Promise<CreateKnowledgeBaseResult> {
    const now = new Date();
    const id = UuidValueObject.generate().value;
    const apiKey = this.generateApiKey.execute();
    const apiKeyHash = this.hashApiKey.execute(apiKey);

    const kb = this.builder
      .withId(id)
      .withName(command.name.value)
      .withDescription(command.description?.value ?? null)
      .withApiKeyHash(apiKeyHash)
      .withCreatedAt(now)
      .withUpdatedAt(now)
      .build();

    kb.create();

    await this.writeRepository.save(kb);
    await this.publishEvents(kb);

    this.logger.log(`KnowledgeBase created: ${kb.id.value}`);

    return {
      id: kb.id.value,
      name: kb.name.value,
      description: kb.description?.value ?? null,
      apiKey,
      createdAt: now,
    };
  }
}
