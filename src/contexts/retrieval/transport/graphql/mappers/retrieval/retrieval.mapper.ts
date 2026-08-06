import { Injectable } from '@nestjs/common';

import { IRetrievalSearchResult } from '@contexts/retrieval/domain/repositories/read/embedding-read.repository';
import { RetrievalSearchResultResponseDto } from '@contexts/retrieval/transport/graphql/dtos/responses/retrieval-search-result.response.dto';

@Injectable()
export class RetrievalGraphQLMapper {
  toResponseDto(
    result: IRetrievalSearchResult,
  ): RetrievalSearchResultResponseDto {
    const dto = new RetrievalSearchResultResponseDto();
    dto.chunkId = result.chunkId;
    dto.documentId = result.documentId;
    dto.chunkText = result.chunkText;
    dto.chunkPosition = result.chunkPosition;
    dto.score = result.score;
    return dto;
  }
}
