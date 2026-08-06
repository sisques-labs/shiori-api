import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class RetrievalSearchDto {
  @ApiProperty({ description: 'Natural-language search query (1-2000 chars)' })
  @IsString()
  @MinLength(1)
  query!: string;

  @ApiPropertyOptional({ description: 'Number of results to return' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  topK?: number;
}
