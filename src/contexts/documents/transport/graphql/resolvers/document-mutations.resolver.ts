import { Logger, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import {
  MutationResponseDto,
  MutationResponseGraphQLMapper,
} from '@sisques-labs/nestjs-kit/graphql';

import { CreateDocumentCommand } from '@contexts/documents/application/commands/create-document/create-document.command';
import { CreateDocumentResult } from '@contexts/documents/application/commands/create-document/create-document.handler';
import { DeleteDocumentCommand } from '@contexts/documents/application/commands/delete-document/delete-document.command';
import { UpdateDocumentCommand } from '@contexts/documents/application/commands/update-document/update-document.command';
import { CurrentKnowledgeBaseId } from '@core/tenancy/current-knowledge-base-id.decorator';
import { KnowledgeBaseApiKeyGuard } from '@core/tenancy/knowledge-base-api-key.guard';

import { CreateDocumentGraphQLDto } from '../dtos/requests/create-document-graphql.dto';
import { UpdateDocumentGraphQLDto } from '../dtos/requests/update-document-graphql.dto';

@UseGuards(KnowledgeBaseApiKeyGuard)
@Resolver()
export class DocumentMutationsResolver {
  private readonly logger = new Logger(DocumentMutationsResolver.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly mutationResponseGraphQLMapper: MutationResponseGraphQLMapper,
  ) {}

  @Mutation(() => MutationResponseDto)
  async createDocument(
    @Args('input') input: CreateDocumentGraphQLDto,
    @CurrentKnowledgeBaseId() knowledgeBaseId: string,
  ): Promise<MutationResponseDto> {
    this.logger.log(`Creating document: ${input.title}`);

    const result = await this.commandBus.execute<
      CreateDocumentCommand,
      CreateDocumentResult
    >(
      new CreateDocumentCommand({
        knowledgeBaseId,
        title: input.title,
        content: input.content,
      }),
    );

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      message: 'Document created successfully',
      id: result.id,
    });
  }

  @Mutation(() => MutationResponseDto)
  async updateDocument(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateDocumentGraphQLDto,
  ): Promise<MutationResponseDto> {
    this.logger.log(`Updating document: ${id}`);

    await this.commandBus.execute(
      new UpdateDocumentCommand({
        id,
        title: input.title,
        content: input.content,
      }),
    );

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      message: 'Document updated successfully',
      id,
    });
  }

  @Mutation(() => MutationResponseDto)
  async deleteDocument(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<MutationResponseDto> {
    this.logger.log(`Deleting document: ${id}`);

    await this.commandBus.execute(new DeleteDocumentCommand({ id }));

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      message: 'Document deleted successfully',
      id,
    });
  }
}
