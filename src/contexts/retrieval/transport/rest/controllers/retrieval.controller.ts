import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import { RetrievalSearchQuery } from '@contexts/retrieval/application/queries/retrieval-search/retrieval-search.query';
import { IRetrievalSearchResult } from '@contexts/retrieval/domain/repositories/read/embedding-read.repository';
import { KnowledgeBaseApiKeyGuard } from '@core/tenancy/knowledge-base-api-key.guard';

import { RetrievalSearchDto } from '../dtos/retrieval-search.dto';
import { RetrievalSearchResultRestResponseDto } from '../dtos/retrieval-search-result-rest-response.dto';
import { RetrievalRestMapper } from '../mappers/retrieval/retrieval.mapper';

@ApiTags('retrieval')
@ApiSecurity('x-api-key')
@Controller('retrieval')
@UseGuards(KnowledgeBaseApiKeyGuard)
export class RetrievalController {
  private readonly logger = new Logger(RetrievalController.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly restMapper: RetrievalRestMapper,
  ) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Semantic search over the caller’s knowledge base' })
  @ApiResponse({ status: 200, type: [RetrievalSearchResultRestResponseDto] })
  async search(
    @Body() dto: RetrievalSearchDto,
  ): Promise<RetrievalSearchResultRestResponseDto[]> {
    this.logger.log(`Searching: "${dto.query}"`);

    const results = await this.queryBus.execute<
      RetrievalSearchQuery,
      IRetrievalSearchResult[]
    >(new RetrievalSearchQuery({ query: dto.query, topK: dto.topK }));

    return results.map((result) => this.restMapper.toResponse(result));
  }
}
