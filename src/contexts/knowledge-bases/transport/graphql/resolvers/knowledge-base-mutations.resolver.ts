import { Logger, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  MutationResponseDto,
  MutationResponseGraphQLMapper,
} from '@sisques-labs/nestjs-kit/graphql';

import { CreateKnowledgeBaseCommand } from '@contexts/knowledge-bases/application/commands/create-knowledge-base/create-knowledge-base.command';
import { CreateKnowledgeBaseResult } from '@contexts/knowledge-bases/application/commands/create-knowledge-base/create-knowledge-base.handler';
import { DeleteKnowledgeBaseCommand } from '@contexts/knowledge-bases/application/commands/delete-knowledge-base/delete-knowledge-base.command';
import { RotateKnowledgeBaseApiKeyCommand } from '@contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.command';
import { RotateKnowledgeBaseApiKeyResult } from '@contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.handler';
import { UpdateKnowledgeBaseCommand } from '@contexts/knowledge-bases/application/commands/update-knowledge-base/update-knowledge-base.command';
import { CurrentKnowledgeBaseId } from '@core/tenancy/current-knowledge-base-id.decorator';
import { SkipKnowledgeBaseAuth } from '@core/tenancy/skip-knowledge-base-auth.decorator';
import { KnowledgeBaseApiKeyGuard } from '@core/tenancy/knowledge-base-api-key.guard';

import { CreateKnowledgeBaseGraphQLDto } from '../dtos/requests/create-knowledge-base-graphql.dto';
import { UpdateKnowledgeBaseGraphQLDto } from '../dtos/requests/update-knowledge-base-graphql.dto';
import { KnowledgeBaseCreatedResponseDto } from '../dtos/responses/knowledge-base-created.response.dto';
import { KnowledgeBaseRotatedApiKeyResponseDto } from '../dtos/responses/knowledge-base-rotated-api-key.response.dto';

@UseGuards(KnowledgeBaseApiKeyGuard)
@Resolver()
export class KnowledgeBaseMutationsResolver {
  private readonly logger = new Logger(KnowledgeBaseMutationsResolver.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly mutationResponseGraphQLMapper: MutationResponseGraphQLMapper,
  ) {}

  @SkipKnowledgeBaseAuth()
  @Mutation(() => KnowledgeBaseCreatedResponseDto)
  async createKnowledgeBase(
    @Args('input') input: CreateKnowledgeBaseGraphQLDto,
  ): Promise<KnowledgeBaseCreatedResponseDto> {
    this.logger.log(`Creating knowledge base: ${input.name}`);

    const result = await this.commandBus.execute<
      CreateKnowledgeBaseCommand,
      CreateKnowledgeBaseResult
    >(
      new CreateKnowledgeBaseCommand({
        name: input.name,
        description: input.description,
      }),
    );

    const dto = new KnowledgeBaseCreatedResponseDto();
    dto.id = result.id;
    dto.name = result.name;
    dto.description = result.description;
    dto.createdAt = result.createdAt;
    dto.updatedAt = result.createdAt;
    dto.apiKey = result.apiKey;
    return dto;
  }

  @Mutation(() => MutationResponseDto)
  async updateKnowledgeBase(
    @Args('input') input: UpdateKnowledgeBaseGraphQLDto,
    @CurrentKnowledgeBaseId() knowledgeBaseId: string,
  ): Promise<MutationResponseDto> {
    this.logger.log(`Updating knowledge base: ${knowledgeBaseId}`);

    await this.commandBus.execute(
      new UpdateKnowledgeBaseCommand({
        id: knowledgeBaseId,
        name: input.name,
        description: input.description,
      }),
    );

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      message: 'Knowledge base updated successfully',
      id: knowledgeBaseId,
    });
  }

  @Mutation(() => MutationResponseDto)
  async deleteKnowledgeBase(
    @CurrentKnowledgeBaseId() knowledgeBaseId: string,
  ): Promise<MutationResponseDto> {
    this.logger.log(`Deleting knowledge base: ${knowledgeBaseId}`);

    await this.commandBus.execute(
      new DeleteKnowledgeBaseCommand({ id: knowledgeBaseId }),
    );

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      message: 'Knowledge base deleted successfully',
      id: knowledgeBaseId,
    });
  }

  @Mutation(() => KnowledgeBaseRotatedApiKeyResponseDto)
  async rotateKnowledgeBaseApiKey(
    @CurrentKnowledgeBaseId() knowledgeBaseId: string,
  ): Promise<KnowledgeBaseRotatedApiKeyResponseDto> {
    this.logger.log(`Rotating API key for knowledge base: ${knowledgeBaseId}`);

    const result = await this.commandBus.execute<
      RotateKnowledgeBaseApiKeyCommand,
      RotateKnowledgeBaseApiKeyResult
    >(new RotateKnowledgeBaseApiKeyCommand({ id: knowledgeBaseId }));

    const dto = new KnowledgeBaseRotatedApiKeyResponseDto();
    dto.apiKey = result.apiKey;
    return dto;
  }
}
