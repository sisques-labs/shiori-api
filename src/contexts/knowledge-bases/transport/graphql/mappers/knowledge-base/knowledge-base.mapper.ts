import { Injectable } from '@nestjs/common';

import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
import { KnowledgeBaseResponseDto } from '@contexts/knowledge-bases/transport/graphql/dtos/responses/knowledge-base.response.dto';

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
}
