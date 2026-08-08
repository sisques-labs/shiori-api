import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeKnowledgeBaseEmbeddingModelDto {
  @ApiProperty({
    description:
      'New embedding model id, picked from GET /embeddings/models. Triggers a blocking re-embed of every document if different from the current model.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  embeddingModel!: string;
}
