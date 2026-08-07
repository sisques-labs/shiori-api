import { Injectable } from '@nestjs/common';

import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';
import { DocumentResponseDto } from '@contexts/documents/transport/graphql/dtos/responses/document.response.dto';

@Injectable()
export class DocumentGraphQLMapper {
  toResponseDto(documentViewModel: DocumentViewModel): DocumentResponseDto {
    const dto = new DocumentResponseDto();
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
