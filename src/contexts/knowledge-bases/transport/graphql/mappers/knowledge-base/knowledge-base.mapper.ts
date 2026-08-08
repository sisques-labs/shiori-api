import { Injectable } from '@nestjs/common';

import { RotateKnowledgeBaseApiKeyResult } from '@contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.handler';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
import { KnowledgeBaseResponseDto } from '@contexts/knowledge-bases/transport/graphql/dtos/responses/knowledge-base.response.dto';
import { KnowledgeBaseRotatedApiKeyResponseDto } from '@contexts/knowledge-bases/transport/graphql/dtos/responses/knowledge-base-rotated-api-key.response.dto';

@Injectable()
export class KnowledgeBaseGraphQLMapper {
  toResponseDto(
    knowledgeBaseViewModel: KnowledgeBaseViewModel,
  ): KnowledgeBaseResponseDto {
    const dto = new KnowledgeBaseResponseDto();
    dto.id = knowledgeBaseViewModel.id;
    dto.name = knowledgeBaseViewModel.name;
    dto.description = knowledgeBaseViewModel.description;
    dto.embeddingModel = knowledgeBaseViewModel.embeddingModel;
    dto.embeddingStatus = knowledgeBaseViewModel.embeddingStatus;
    dto.createdAt = knowledgeBaseViewModel.createdAt;
    dto.updatedAt = knowledgeBaseViewModel.updatedAt;
    return dto;
  }

  toRotatedApiKeyResponseDto(
    result: RotateKnowledgeBaseApiKeyResult,
  ): KnowledgeBaseRotatedApiKeyResponseDto {
    const dto = new KnowledgeBaseRotatedApiKeyResponseDto();
    dto.apiKey = result.apiKey;
    return dto;
  }
}
