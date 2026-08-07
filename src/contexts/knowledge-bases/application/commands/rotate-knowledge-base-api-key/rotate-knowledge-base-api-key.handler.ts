import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseAggregate } from '@contexts/knowledge-bases/domain/aggregates/knowledge-base.aggregate';
import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { AssertKnowledgeBaseExistsService } from '@contexts/knowledge-bases/application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import { GenerateApiKeyService } from '@contexts/knowledge-bases/application/services/write/generate-api-key/generate-api-key.service';
import { HashApiKeyService } from '@core/tenancy/hash-api-key.service';
import {
  KNOWLEDGE_BASE_WRITE_REPOSITORY,
  IKnowledgeBaseWriteRepository,
} from '@contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';

import { RotateKnowledgeBaseApiKeyCommand } from './rotate-knowledge-base-api-key.command';

export interface RotateKnowledgeBaseApiKeyResult {
  apiKey: string;
}

@CommandHandler(RotateKnowledgeBaseApiKeyCommand)
export class RotateKnowledgeBaseApiKeyCommandHandler
  extends BaseCommandHandler<
    RotateKnowledgeBaseApiKeyCommand,
    KnowledgeBaseAggregate
  >
  implements
    ICommandHandler<
      RotateKnowledgeBaseApiKeyCommand,
      RotateKnowledgeBaseApiKeyResult
    >
{
  private readonly logger = new Logger(
    RotateKnowledgeBaseApiKeyCommandHandler.name,
  );

  constructor(
    @Inject(KNOWLEDGE_BASE_WRITE_REPOSITORY)
    private readonly writeRepository: IKnowledgeBaseWriteRepository,
    private readonly assertExists: AssertKnowledgeBaseExistsService,
    private readonly generateApiKey: GenerateApiKeyService,
    private readonly hashApiKey: HashApiKeyService,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(
    command: RotateKnowledgeBaseApiKeyCommand,
  ): Promise<RotateKnowledgeBaseApiKeyResult> {
    const knowledgeBase = await this.assertExists.execute(command.id);

    const apiKey = await this.generateApiKey.execute();
    const apiKeyHash = this.hashApiKey.execute(apiKey);

    knowledgeBase.rotateApiKey(
      new KnowledgeBaseApiKeyHashValueObject(apiKeyHash),
    );

    await this.writeRepository.save(knowledgeBase);
    await this.publishEvents(knowledgeBase);

    this.logger.log(`KnowledgeBase API key rotated: ${command.id.value}`);

    return { apiKey };
  }
}
