import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Never includes apiKeyHash or apiKey. */
export class KnowledgeBaseRestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ description: 'Current embedding model id' })
  embeddingModel!: string;

  @ApiProperty({
    description: 'READY | REEMBEDDING | FAILED',
    enum: ['READY', 'REEMBEDDING', 'FAILED'],
  })
  embeddingStatus!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
