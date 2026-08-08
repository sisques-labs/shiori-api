import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateKnowledgeBaseDto {
  @ApiProperty({ description: 'Display name (1-100 chars)' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Optional description (max 2000 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    description:
      'Embedding model id, picked from GET /embeddings/models (e.g. "text-embedding-3-small")',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  embeddingModel!: string;
}
