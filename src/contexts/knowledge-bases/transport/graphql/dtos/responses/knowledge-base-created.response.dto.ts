import { Field, ObjectType } from '@nestjs/graphql';

import { KnowledgeBaseResponseDto } from './knowledge-base.response.dto';

/**
 * A dedicated `ObjectType` rather than the generic `MutationResponseDto`
 * because the caller needs the plaintext `apiKey`, shown only here.
 */
@ObjectType('KnowledgeBaseCreatedResponseDto')
export class KnowledgeBaseCreatedResponseDto extends KnowledgeBaseResponseDto {
  @Field(() => String, {
    description:
      'Plaintext API key — shown only in this response. Store it now; it cannot be retrieved again.',
  })
  apiKey!: string;
}
