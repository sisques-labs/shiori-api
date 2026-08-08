import { Injectable } from '@nestjs/common';

import { EmbeddingModelDefinition } from '@contexts/embeddings/domain/constants/embedding-models-registry.constant';
import { EmbeddingModelResponseDto } from '@contexts/embeddings/transport/graphql/dtos/responses/embedding-model.response.dto';

@Injectable()
export class EmbeddingModelGraphQLMapper {
  toResponseDto(model: EmbeddingModelDefinition): EmbeddingModelResponseDto {
    const dto = new EmbeddingModelResponseDto();
    dto.id = model.id;
    dto.provider = model.provider;
    dto.dimensions = model.dimensions;
    return dto;
  }
}
