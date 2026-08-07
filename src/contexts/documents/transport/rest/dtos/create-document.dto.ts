import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ description: 'Title (1-255 chars)' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Plain text or Markdown content' })
  @IsString()
  @MinLength(1)
  content!: string;
}
