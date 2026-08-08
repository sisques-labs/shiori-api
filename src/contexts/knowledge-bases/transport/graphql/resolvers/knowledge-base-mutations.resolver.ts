import { Logger, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  MutationResponseDto,
  MutationResponseGraphQLMapper,
} from '@sisques-labs/nestjs-kit/graphql';

import { ChangeKnowledgeBaseEmbeddingModelCommand } from '@contexts/knowledge-bases/application/commands/change-knowledge-base-embedding-model/change-knowledge-base-embedding-model.command';
import { CreateKnowledgeBaseCommand } from '@contexts/knowledge-bases/application/commands/create-knowledge-base/create-knowledge-base.command';
import { CreateKnowledgeBaseResult } from '@contexts/knowledge-bases/application/commands/create-knowledge-base/create-knowledge-base.handler';
import { DeleteKnowledgeBaseCommand } from '@contexts/knowledge-bases/application/commands/delete-knowledge-base/delete-knowledge-base.command';
import { ReembedKnowledgeBaseCommand } from '@contexts/knowledge-bases/application/commands/reembed-knowledge-base/reembed-knowledge-base.command';
import { RotateKnowledgeBaseApiKeyCommand } from '@contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.command';
import { RotateKnowledgeBaseApiKeyResult } from '@contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.handler';
import { UpdateKnowledgeBaseCommand } from '@contexts/knowledge-bases/application/commands/update-knowledge-base/update-knowledge-base.command';
import { AssertKnowledgeBaseViewModelExistsService } from '@contexts/knowledge-bases/application/services/read/assert-knowledge-base-view-model-exists/assert-knowledge-base-view-model-exists.service';
import { CurrentKnowledgeBaseId } from '@core/tenancy/current-knowledge-base-id.decorator';
import { SkipKnowledgeBaseAuth } from '@core/tenancy/skip-knowledge-base-auth.decorator';
import { KnowledgeBaseApiKeyGuard } from '@core/tenancy/knowledge-base-api-key.guard';

import { ChangeKnowledgeBaseEmbeddingModelGraphQLDto } from '../dtos/requests/change-knowledge-base-embedding-model-graphql.dto';
import { CreateKnowledgeBaseGraphQLDto } from '../dtos/requests/create-knowledge-base-graphql.dto';
import { UpdateKnowledgeBaseGraphQLDto } from '../dtos/requests/update-knowledge-base-graphql.dto';
import { KnowledgeBaseCreatedResponseDto } from '../dtos/responses/knowledge-base-created.response.dto';
import { KnowledgeBaseRotatedApiKeyResponseDto } from '../dtos/responses/knowledge-base-rotated-api-key.response.dto';
import { KnowledgeBaseGraphQLMapper } from '../mappers/knowledge-base/knowledge-base.mapper';

@UseGuards(KnowledgeBaseApiKeyGuard)
@Resolver()
export class KnowledgeBaseMutationsResolver {
  private readonly logger = new Logger(KnowledgeBaseMutationsResolver.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly mutationResponseGraphQLMapper: MutationResponseGraphQLMapper,
    private readonly graphQLMapper: KnowledgeBaseGraphQLMapper,
    private readonly assertViewModelExists: AssertKnowledgeBaseViewModelExistsService,
  ) {}

  @SkipKnowledgeBaseAuth()
  @Mutation(() => KnowledgeBaseCreatedResponseDto)
  async createKnowledgeBase(
    @Args('input') input: CreateKnowledgeBaseGraphQLDto,
  ): Promise<KnowledgeBaseCreatedResponseDto> {
    this.logger.log(`Creating knowledge base: ${input.name}`);

    const { id, apiKey } = await this.commandBus.execute<
      CreateKnowledgeBaseCommand,
      CreateKnowledgeBaseResult
    >(
      new CreateKnowledgeBaseCommand({
        name: input.name,
        description: input.description,
        embeddingModel: input.embeddingModel,
      }),
    );

    const knowledgeBaseViewModel = await this.assertViewModelExists.execute(id);
    const dto = this.graphQLMapper.toResponseDto(
      knowledgeBaseViewModel,
    ) as KnowledgeBaseCreatedResponseDto;
    dto.apiKey = apiKey;
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

  @Mutation(() => MutationResponseDto)
  async changeKnowledgeBaseEmbeddingModel(
    @Args('input') input: ChangeKnowledgeBaseEmbeddingModelGraphQLDto,
    @CurrentKnowledgeBaseId() knowledgeBaseId: string,
  ): Promise<MutationResponseDto> {
    this.logger.log(
      `Changing embedding model for knowledge base: ${knowledgeBaseId}`,
    );

    await this.commandBus.execute(
      new ChangeKnowledgeBaseEmbeddingModelCommand({
        id: knowledgeBaseId,
        embeddingModel: input.embeddingModel,
      }),
    );

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      message: 'Knowledge base embedding model change requested',
      id: knowledgeBaseId,
    });
  }

  @Mutation(() => MutationResponseDto)
  async reembedKnowledgeBase(
    @CurrentKnowledgeBaseId() knowledgeBaseId: string,
  ): Promise<MutationResponseDto> {
    this.logger.log(
      `Requesting reembedding for knowledge base: ${knowledgeBaseId}`,
    );

    await this.commandBus.execute(
      new ReembedKnowledgeBaseCommand({ id: knowledgeBaseId }),
    );

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      message: 'Knowledge base reembedding requested',
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

    return this.graphQLMapper.toRotatedApiKeyResponseDto(result);
  }
}
