import { ApiProperty } from '@nestjs/swagger';

import { KnowledgeBaseRestResponseDto } from './knowledge-base-rest-response.dto';

export class KnowledgeBaseCreatedRestResponseDto extends KnowledgeBaseRestResponseDto {
  @ApiProperty({
    description:
      'Plaintext API key — shown only in this response. Store it now; it cannot be retrieved again.',
  })
  apiKey!: string;
}
