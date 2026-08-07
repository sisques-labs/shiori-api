import { Injectable } from '@nestjs/common';

import { CreateKnowledgeBaseResult } from '@contexts/knowledge-bases/application/commands/create-knowledge-base/create-knowledge-base.handler';
import { RotateKnowledgeBaseApiKeyResult } from '@contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.handler';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
import { KnowledgeBaseCreatedResponseDto } from '@contexts/knowledge-bases/transport/graphql/dtos/responses/knowledge-base-created.response.dto';
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
    dto.createdAt = knowledgeBaseViewModel.createdAt;
    dto.updatedAt = knowledgeBaseViewModel.updatedAt;
    return dto;
  }

  toCreatedResponseDto(
    result: CreateKnowledgeBaseResult,
  ): KnowledgeBaseCreatedResponseDto {
    const dto = new KnowledgeBaseCreatedResponseDto();
    dto.id = result.id;
    dto.name = result.name;
    dto.description = result.description;
    dto.createdAt = result.createdAt;
    dto.updatedAt = result.createdAt;
    dto.apiKey = result.apiKey;
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
