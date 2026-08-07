import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDocumentDto {
  @ApiPropertyOptional({ description: 'Title (1-255 chars)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Plain text or Markdown content' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;
}
