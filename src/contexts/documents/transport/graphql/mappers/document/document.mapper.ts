import { Injectable } from '@nestjs/common';

import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';
import { DocumentResponseDto } from '@contexts/documents/transport/graphql/dtos/responses/document.response.dto';

@Injectable()
export class DocumentGraphQLMapper {
  toResponseDto(vm: DocumentViewModel): DocumentResponseDto {
    const dto = new DocumentResponseDto();
    dto.id = vm.id;
    dto.title = vm.title;
    dto.content = vm.content;
    dto.status = vm.status;
    dto.failureReason = vm.failureReason;
    dto.chunkCount = vm.chunkCount;
    dto.createdAt = vm.createdAt;
    dto.updatedAt = vm.updatedAt;
    return dto;
  }
}
