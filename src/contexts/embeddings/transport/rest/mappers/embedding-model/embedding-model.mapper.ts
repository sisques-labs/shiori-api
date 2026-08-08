import { Injectable } from '@nestjs/common';

import { EmbeddingModelDefinition } from '@contexts/embeddings/domain/constants/embedding-models-registry.constant';
import { EmbeddingModelRestResponseDto } from '@contexts/embeddings/transport/rest/dtos/embedding-model-rest-response.dto';

@Injectable()
export class EmbeddingModelRestMapper {
  toResponse(model: EmbeddingModelDefinition): EmbeddingModelRestResponseDto {
    const dto = new EmbeddingModelRestResponseDto();
    dto.id = model.id;
    dto.provider = model.provider;
    dto.dimensions = model.dimensions;
    return dto;
  }
}
