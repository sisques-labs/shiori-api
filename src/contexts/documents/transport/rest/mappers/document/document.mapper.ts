import { Injectable } from '@nestjs/common';

import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';
import { DocumentRestResponseDto } from '@contexts/documents/transport/rest/dtos/document-rest-response.dto';

@Injectable()
export class DocumentRestMapper {
  toResponse(documentViewModel: DocumentViewModel): DocumentRestResponseDto {
    const dto = new DocumentRestResponseDto();
    dto.id = documentViewModel.id;
    dto.title = documentViewModel.title;
    dto.content = documentViewModel.content;
    dto.status = documentViewModel.status;
    dto.failureReason = documentViewModel.failureReason;
    dto.chunkCount = documentViewModel.chunkCount;
    dto.createdAt = documentViewModel.createdAt;
    dto.updatedAt = documentViewModel.updatedAt;
    return dto;
  }
}
