import { ApiProperty } from '@nestjs/swagger';

export class KnowledgeBaseRotatedApiKeyRestResponseDto {
  @ApiProperty({
    description:
      'New plaintext API key — shown only in this response. The previous key stops working immediately.',
  })
  apiKey!: string;
}
