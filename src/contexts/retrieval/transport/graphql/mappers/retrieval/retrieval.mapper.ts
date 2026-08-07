import { Injectable } from '@nestjs/common';

import { IRetrievalSearchResult } from '@contexts/retrieval/application/ports/embedding-search.port';
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
