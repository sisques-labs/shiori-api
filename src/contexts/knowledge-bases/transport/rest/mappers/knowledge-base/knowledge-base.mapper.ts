import { Injectable } from '@nestjs/common';

import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
import { KnowledgeBaseRestResponseDto } from '@contexts/knowledge-bases/transport/rest/dtos/knowledge-base-rest-response.dto';

@Injectable()
export class KnowledgeBaseRestMapper {
  toResponse(vm: KnowledgeBaseViewModel): KnowledgeBaseRestResponseDto {
    const dto = new KnowledgeBaseRestResponseDto();
    dto.id = vm.id;
    dto.name = vm.name;
    dto.description = vm.description;
    dto.createdAt = vm.createdAt;
    dto.updatedAt = vm.updatedAt;
    return dto;
  }
}
