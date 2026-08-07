import { Injectable } from '@nestjs/common';

import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
import { KnowledgeBaseRestResponseDto } from '@contexts/knowledge-bases/transport/rest/dtos/knowledge-base-rest-response.dto';

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
}
