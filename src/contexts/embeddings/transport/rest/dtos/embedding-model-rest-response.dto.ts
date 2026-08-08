import { ApiProperty } from '@nestjs/swagger';

export class EmbeddingModelRestResponseDto {
  @ApiProperty({ description: 'Model id, sent to the provider as-is' })
  id!: string;

  @ApiProperty({ description: 'Informational only (e.g. "openai", "ollama")' })
  provider!: string;

  @ApiProperty({ description: 'pgvector column width this model produces' })
  dimensions!: number;
}
