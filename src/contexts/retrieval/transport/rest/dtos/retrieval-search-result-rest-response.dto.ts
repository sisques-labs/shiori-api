import { ApiProperty } from '@nestjs/swagger';

export class RetrievalSearchResultRestResponseDto {
  @ApiProperty()
  chunkId!: string;

  @ApiProperty()
  documentId!: string;

  @ApiProperty()
  chunkText!: string;

  @ApiProperty()
  chunkPosition!: number;

  @ApiProperty()
  score!: number;
}
