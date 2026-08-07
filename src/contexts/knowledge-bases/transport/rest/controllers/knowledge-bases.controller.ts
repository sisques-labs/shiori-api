import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import { CreateKnowledgeBaseCommand } from '@contexts/knowledge-bases/application/commands/create-knowledge-base/create-knowledge-base.command';
import { CreateKnowledgeBaseResult } from '@contexts/knowledge-bases/application/commands/create-knowledge-base/create-knowledge-base.handler';
import { DeleteKnowledgeBaseCommand } from '@contexts/knowledge-bases/application/commands/delete-knowledge-base/delete-knowledge-base.command';
import { RotateKnowledgeBaseApiKeyCommand } from '@contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.command';
import { RotateKnowledgeBaseApiKeyResult } from '@contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.handler';
import { UpdateKnowledgeBaseCommand } from '@contexts/knowledge-bases/application/commands/update-knowledge-base/update-knowledge-base.command';
import { AssertKnowledgeBaseViewModelExistsService } from '@contexts/knowledge-bases/application/services/read/assert-knowledge-base-view-model-exists/assert-knowledge-base-view-model-exists.service';
import { CurrentKnowledgeBaseId } from '@core/tenancy/current-knowledge-base-id.decorator';
import { SkipKnowledgeBaseAuth } from '@core/tenancy/skip-knowledge-base-auth.decorator';
import { KnowledgeBaseApiKeyGuard } from '@core/tenancy/knowledge-base-api-key.guard';

import { CreateKnowledgeBaseDto } from '../dtos/create-knowledge-base.dto';
import { KnowledgeBaseCreatedRestResponseDto } from '../dtos/knowledge-base-created-rest-response.dto';
import { KnowledgeBaseRestResponseDto } from '../dtos/knowledge-base-rest-response.dto';
import { KnowledgeBaseRotatedApiKeyRestResponseDto } from '../dtos/knowledge-base-rotated-api-key-rest-response.dto';
import { UpdateKnowledgeBaseDto } from '../dtos/update-knowledge-base.dto';
import { KnowledgeBaseRestMapper } from '../mappers/knowledge-base/knowledge-base.mapper';

@ApiTags('knowledge-bases')
@Controller('knowledge-bases')
export class KnowledgeBasesController {
  private readonly logger = new Logger(KnowledgeBasesController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly assertViewModelExists: AssertKnowledgeBaseViewModelExistsService,
    private readonly restMapper: KnowledgeBaseRestMapper,
  ) {}

  @Post()
  @SkipKnowledgeBaseAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a knowledge base (no auth required)' })
  @ApiResponse({ status: 201, type: KnowledgeBaseCreatedRestResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createKnowledgeBase(
    @Body() dto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseCreatedRestResponseDto> {
    this.logger.log(`Creating knowledge base: ${dto.name}`);

    const result = await this.commandBus.execute<
      CreateKnowledgeBaseCommand,
      CreateKnowledgeBaseResult
    >(
      new CreateKnowledgeBaseCommand({
        name: dto.name,
        description: dto.description,
      }),
    );

    const response = new KnowledgeBaseCreatedRestResponseDto();
    response.id = result.id;
    response.name = result.name;
    response.description = result.description;
    response.createdAt = result.createdAt;
    response.updatedAt = result.createdAt;
    response.apiKey = result.apiKey;
    return response;
  }

  @Get('me')
  @UseGuards(KnowledgeBaseApiKeyGuard)
  @ApiSecurity('x-api-key')
  @ApiOperation({ summary: 'Get the caller’s own knowledge base' })
  @ApiResponse({ status: 200, type: KnowledgeBaseRestResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-API-Key' })
  async getOwnKnowledgeBase(
    @CurrentKnowledgeBaseId() knowledgeBaseId: string,
  ): Promise<KnowledgeBaseRestResponseDto> {
    this.logger.log(`Fetching knowledge base: ${knowledgeBaseId}`);

    const knowledgeBaseViewModel =
      await this.assertViewModelExists.execute(knowledgeBaseId);
    return this.restMapper.toResponse(knowledgeBaseViewModel);
  }

  @Patch('me')
  @UseGuards(KnowledgeBaseApiKeyGuard)
  @ApiSecurity('x-api-key')
  @ApiOperation({ summary: 'Update the caller’s own knowledge base' })
  @ApiResponse({ status: 200, type: KnowledgeBaseRestResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-API-Key' })
  async updateOwnKnowledgeBase(
    @CurrentKnowledgeBaseId() knowledgeBaseId: string,
    @Body() dto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseRestResponseDto> {
    this.logger.log(`Updating knowledge base: ${knowledgeBaseId}`);

    await this.commandBus.execute(
      new UpdateKnowledgeBaseCommand({
        id: knowledgeBaseId,
        name: dto.name,
        description: dto.description,
      }),
    );

    const knowledgeBaseViewModel =
      await this.assertViewModelExists.execute(knowledgeBaseId);
    return this.restMapper.toResponse(knowledgeBaseViewModel);
  }

  @Delete('me')
  @UseGuards(KnowledgeBaseApiKeyGuard)
  @ApiSecurity('x-api-key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete the caller’s own knowledge base' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-API-Key' })
  async deleteOwnKnowledgeBase(
    @CurrentKnowledgeBaseId() knowledgeBaseId: string,
  ): Promise<void> {
    this.logger.log(`Deleting knowledge base: ${knowledgeBaseId}`);

    await this.commandBus.execute(
      new DeleteKnowledgeBaseCommand({ id: knowledgeBaseId }),
    );
  }

  @Post('me/rotate-api-key')
  @UseGuards(KnowledgeBaseApiKeyGuard)
  @ApiSecurity('x-api-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the caller’s own API key' })
  @ApiResponse({ status: 200, type: KnowledgeBaseRotatedApiKeyRestResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-API-Key' })
  async rotateOwnApiKey(
    @CurrentKnowledgeBaseId() knowledgeBaseId: string,
  ): Promise<KnowledgeBaseRotatedApiKeyRestResponseDto> {
    this.logger.log(`Rotating API key for knowledge base: ${knowledgeBaseId}`);

    const result = await this.commandBus.execute<
      RotateKnowledgeBaseApiKeyCommand,
      RotateKnowledgeBaseApiKeyResult
    >(new RotateKnowledgeBaseApiKeyCommand({ id: knowledgeBaseId }));

    const response = new KnowledgeBaseRotatedApiKeyRestResponseDto();
    response.apiKey = result.apiKey;
    return response;
  }
}
