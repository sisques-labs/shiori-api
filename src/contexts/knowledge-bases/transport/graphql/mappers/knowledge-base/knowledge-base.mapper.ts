import { Injectable } from '@nestjs/common';

import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
import { KnowledgeBaseResponseDto } from '@contexts/knowledge-bases/transport/graphql/dtos/responses/knowledge-base.response.dto';

@Injectable()
export class KnowledgeBaseGraphQLMapper {
  toResponseDto(vm: KnowledgeBaseViewModel): KnowledgeBaseResponseDto {
    const dto = new KnowledgeBaseResponseDto();
    dto.id = vm.id;
    dto.name = vm.name;
    dto.description = vm.description;
    dto.createdAt = vm.createdAt;
    dto.updatedAt = vm.updatedAt;
    return dto;
  }
}
