import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateKnowledgeBaseDto {
  @ApiPropertyOptional({ description: 'Display name (1-100 chars)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Description (max 2000 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
