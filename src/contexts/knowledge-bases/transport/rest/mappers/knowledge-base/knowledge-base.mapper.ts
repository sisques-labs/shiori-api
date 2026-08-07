import { Injectable } from '@nestjs/common';

import { CreateKnowledgeBaseResult } from '@contexts/knowledge-bases/application/commands/create-knowledge-base/create-knowledge-base.handler';
import { RotateKnowledgeBaseApiKeyResult } from '@contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.handler';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
import { KnowledgeBaseCreatedRestResponseDto } from '@contexts/knowledge-bases/transport/rest/dtos/knowledge-base-created-rest-response.dto';
import { KnowledgeBaseRestResponseDto } from '@contexts/knowledge-bases/transport/rest/dtos/knowledge-base-rest-response.dto';
import { KnowledgeBaseRotatedApiKeyRestResponseDto } from '@contexts/knowledge-bases/transport/rest/dtos/knowledge-base-rotated-api-key-rest-response.dto';

@Injectable()
export class KnowledgeBaseRestMapper {
  toResponse(
    knowledgeBaseViewModel: KnowledgeBaseViewModel,
  ): KnowledgeBaseRestResponseDto {
    const dto = new KnowledgeBaseRestResponseDto();
    dto.id = knowledgeBaseViewModel.id;
    dto.name = knowledgeBaseViewModel.name;
    dto.description = knowledgeBaseViewModel.description;
    dto.createdAt = knowledgeBaseViewModel.createdAt;
    dto.updatedAt = knowledgeBaseViewModel.updatedAt;
    return dto;
  }

  toCreatedResponse(
    result: CreateKnowledgeBaseResult,
  ): KnowledgeBaseCreatedRestResponseDto {
    const dto = new KnowledgeBaseCreatedRestResponseDto();
    dto.id = result.id;
    dto.name = result.name;
    dto.description = result.description;
    dto.createdAt = result.createdAt;
    dto.updatedAt = result.createdAt;
    dto.apiKey = result.apiKey;
    return dto;
  }

  toRotatedApiKeyResponse(
    result: RotateKnowledgeBaseApiKeyResult,
  ): KnowledgeBaseRotatedApiKeyRestResponseDto {
    const dto = new KnowledgeBaseRotatedApiKeyRestResponseDto();
    dto.apiKey = result.apiKey;
    return dto;
  }
}
