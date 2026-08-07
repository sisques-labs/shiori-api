import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Never includes apiKeyHash or apiKey. */
export class KnowledgeBaseRestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
