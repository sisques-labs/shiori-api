import { Logger, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { AssertKnowledgeBaseViewModelExistsService } from '@contexts/knowledge-bases/application/services/read/assert-knowledge-base-view-model-exists/assert-knowledge-base-view-model-exists.service';
import { CurrentKnowledgeBaseId } from '@core/tenancy/current-knowledge-base-id.decorator';
import { KnowledgeBaseApiKeyGuard } from '@core/tenancy/knowledge-base-api-key.guard';

import { KnowledgeBaseResponseDto } from '../dtos/responses/knowledge-base.response.dto';
import { KnowledgeBaseGraphQLMapper } from '../mappers/knowledge-base/knowledge-base.mapper';

@UseGuards(KnowledgeBaseApiKeyGuard)
@Resolver(() => KnowledgeBaseResponseDto)
export class KnowledgeBaseQueriesResolver {
  private readonly logger = new Logger(KnowledgeBaseQueriesResolver.name);

  constructor(
    private readonly assertViewModelExists: AssertKnowledgeBaseViewModelExistsService,
    private readonly graphQLMapper: KnowledgeBaseGraphQLMapper,
  ) {}

  @Query(() => KnowledgeBaseResponseDto)
  async knowledgeBase(
    @CurrentKnowledgeBaseId() knowledgeBaseId: string,
  ): Promise<KnowledgeBaseResponseDto> {
    this.logger.log(`Fetching knowledge base: ${knowledgeBaseId}`);

    const knowledgeBaseViewModel =
      await this.assertViewModelExists.execute(knowledgeBaseId);
    return this.graphQLMapper.toResponseDto(knowledgeBaseViewModel);
  }
}
