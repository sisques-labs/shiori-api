import { Injectable } from '@nestjs/common';

import { RotateKnowledgeBaseApiKeyResult } from '@contexts/knowledge-bases/application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.handler';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
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
    dto.embeddingModel = knowledgeBaseViewModel.embeddingModel;
    dto.embeddingStatus = knowledgeBaseViewModel.embeddingStatus;
    dto.createdAt = knowledgeBaseViewModel.createdAt;
    dto.updatedAt = knowledgeBaseViewModel.updatedAt;
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
