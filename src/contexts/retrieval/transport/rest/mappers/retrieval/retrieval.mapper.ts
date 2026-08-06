import { Injectable } from '@nestjs/common';

import { IRetrievalSearchResult } from '@contexts/retrieval/domain/repositories/read/embedding-read.repository';
import { RetrievalSearchResultRestResponseDto } from '@contexts/retrieval/transport/rest/dtos/retrieval-search-result-rest-response.dto';

@Injectable()
export class RetrievalRestMapper {
  toResponse(
    result: IRetrievalSearchResult,
  ): RetrievalSearchResultRestResponseDto {
    const dto = new RetrievalSearchResultRestResponseDto();
    dto.chunkId = result.chunkId;
    dto.documentId = result.documentId;
    dto.chunkText = result.chunkText;
    dto.chunkPosition = result.chunkPosition;
    dto.score = result.score;
    return dto;
  }
}
