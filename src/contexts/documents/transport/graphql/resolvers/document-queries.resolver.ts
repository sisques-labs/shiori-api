import { Logger, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { Criteria, PaginatedResult } from '@sisques-labs/nestjs-kit';
import { FilterValidationPipe } from '@sisques-labs/nestjs-kit/graphql';

import { DocumentFindByCriteriaQuery } from '@contexts/documents/application/queries/document-find-by-criteria/document-find-by-criteria.query';
import { AssertDocumentViewModelExistsService } from '@contexts/documents/application/services/read/assert-document-view-model-exists/assert-document-view-model-exists.service';
import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';
import { documentFilterableFields } from '@contexts/documents/transport/graphql/registries/document-filterable-fields.registry';
import { KnowledgeBaseApiKeyGuard } from '@core/tenancy/knowledge-base-api-key.guard';

import { DocumentFindByCriteriaRequestDto } from '../dtos/requests/document-find-by-criteria-graphql.dto';
import {
  DocumentResponseDto,
  PaginatedDocumentResultDto,
} from '../dtos/responses/document.response.dto';
import { DocumentGraphQLMapper } from '../mappers/document/document.mapper';

@UseGuards(KnowledgeBaseApiKeyGuard)
@Resolver(() => DocumentResponseDto)
export class DocumentQueriesResolver {
  private readonly logger = new Logger(DocumentQueriesResolver.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly graphQLMapper: DocumentGraphQLMapper,
    private readonly assertViewModelExists: AssertDocumentViewModelExistsService,
  ) {}

  @Query(() => DocumentResponseDto, { nullable: true })
  async documentFindById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<DocumentResponseDto | null> {
    this.logger.log(`Finding document: ${id}`);

    const documentViewModel = await this.assertViewModelExists.execute(id);
    return this.graphQLMapper.toResponseDto(documentViewModel);
  }

  @Query(() => PaginatedDocumentResultDto)
  async documentFindByCriteria(
    @Args(
      'input',
      { nullable: true },
      new FilterValidationPipe(documentFilterableFields),
    )
    input?: DocumentFindByCriteriaRequestDto,
  ): Promise<PaginatedDocumentResultDto> {
    this.logger.log('Finding documents by criteria');

    const criteria = new Criteria(
      input?.filters,
      input?.sorts,
      input?.pagination,
    );

    const result = await this.queryBus.execute<
      DocumentFindByCriteriaQuery,
      PaginatedResult<DocumentViewModel>
    >(new DocumentFindByCriteriaQuery({ criteria }));

    return {
      items: result.items.map((documentViewModel) =>
        this.graphQLMapper.toResponseDto(documentViewModel),
      ),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
    };
  }
}
