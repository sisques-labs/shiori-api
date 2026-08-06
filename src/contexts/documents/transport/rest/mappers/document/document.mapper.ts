import { Injectable } from '@nestjs/common';

import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';
import { DocumentRestResponseDto } from '@contexts/documents/transport/rest/dtos/document-rest-response.dto';

@Injectable()
export class DocumentRestMapper {
  toResponse(vm: DocumentViewModel): DocumentRestResponseDto {
    const dto = new DocumentRestResponseDto();
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
