import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Criteria, PaginatedResult } from '@sisques-labs/nestjs-kit';

import { CreateDocumentCommand } from '@contexts/documents/application/commands/create-document/create-document.command';
import { CreateDocumentResult } from '@contexts/documents/application/commands/create-document/create-document.handler';
import { DeleteDocumentCommand } from '@contexts/documents/application/commands/delete-document/delete-document.command';
import { RechunkDocumentCommand } from '@contexts/documents/application/commands/rechunk-document/rechunk-document.command';
import { UpdateDocumentCommand } from '@contexts/documents/application/commands/update-document/update-document.command';
import { DocumentFindByCriteriaQuery } from '@contexts/documents/application/queries/document-find-by-criteria/document-find-by-criteria.query';
import { AssertDocumentViewModelExistsService } from '@contexts/documents/application/services/read/assert-document-view-model-exists/assert-document-view-model-exists.service';
import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';
import { CurrentKnowledgeBaseId } from '@core/tenancy/current-knowledge-base-id.decorator';
import { KnowledgeBaseApiKeyGuard } from '@core/tenancy/knowledge-base-api-key.guard';

import { CreateDocumentDto } from '../dtos/create-document.dto';
import { DocumentRestResponseDto } from '../dtos/document-rest-response.dto';
import { UpdateDocumentDto } from '../dtos/update-document.dto';
import { DocumentRestMapper } from '../mappers/document/document.mapper';

@ApiTags('documents')
@ApiSecurity('x-api-key')
@Controller('documents')
@UseGuards(KnowledgeBaseApiKeyGuard)
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly assertViewModelExists: AssertDocumentViewModelExistsService,
    private readonly restMapper: DocumentRestMapper,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create a document (queues async chunking)' })
  @ApiResponse({ status: 202, description: 'Accepted, chunking queued' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 413, description: 'Content too large' })
  async createDocument(
    @Body() dto: CreateDocumentDto,
    @CurrentKnowledgeBaseId() knowledgeBaseId: string,
  ): Promise<{ id: string; status: string }> {
    this.logger.log(`Creating document: ${dto.title}`);

    return this.commandBus.execute<CreateDocumentCommand, CreateDocumentResult>(
      new CreateDocumentCommand({
        knowledgeBaseId,
        title: dto.title,
        content: dto.content,
      }),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List documents in the caller’s knowledge base' })
  @ApiResponse({ status: 200 })
  async documentsFindByCriteria(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedResult<DocumentRestResponseDto>> {
    this.logger.log('Listing documents by criteria');

    const criteria = new Criteria(
      [],
      [],
      page != null
        ? { page: Number(page), perPage: Number(limit ?? 20) }
        : undefined,
    );

    const result = await this.queryBus.execute<
      DocumentFindByCriteriaQuery,
      PaginatedResult<DocumentViewModel>
    >(new DocumentFindByCriteriaQuery({ criteria }));

    return new PaginatedResult(
      result.items.map((documentViewModel) =>
        this.restMapper.toResponse(documentViewModel),
      ),
      result.total,
      result.page,
      result.perPage,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a document by ID' })
  @ApiResponse({ status: 200, type: DocumentRestResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async documentFindById(
    @Param('id') id: string,
  ): Promise<DocumentRestResponseDto> {
    this.logger.log(`Finding document: ${id}`);

    const documentViewModel = await this.assertViewModelExists.execute(id);
    return this.restMapper.toResponse(documentViewModel);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a document (re-queues chunking on content change)',
  })
  @ApiResponse({ status: 200, type: DocumentRestResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 413, description: 'Content too large' })
  @ApiResponse({ status: 422, description: 'Document is currently chunking' })
  async updateDocument(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentRestResponseDto> {
    this.logger.log(`Updating document: ${id}`);

    await this.commandBus.execute(
      new UpdateDocumentCommand({ id, title: dto.title, content: dto.content }),
    );

    const documentViewModel = await this.assertViewModelExists.execute(id);
    return this.restMapper.toResponse(documentViewModel);
  }

  @Post(':id/rechunk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Force a re-chunk of a document under its current content (no content change required)',
  })
  @ApiResponse({ status: 200, type: DocumentRestResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 422, description: 'Document is currently chunking' })
  async rechunkDocument(
    @Param('id') id: string,
  ): Promise<DocumentRestResponseDto> {
    this.logger.log(`Requesting rechunk for document: ${id}`);

    await this.commandBus.execute(new RechunkDocumentCommand({ id }));

    const documentViewModel = await this.assertViewModelExists.execute(id);
    return this.restMapper.toResponse(documentViewModel);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document (cascades to its chunks)' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async deleteDocument(@Param('id') id: string): Promise<void> {
    this.logger.log(`Deleting document: ${id}`);

    await this.commandBus.execute(new DeleteDocumentCommand({ id }));
  }
}
