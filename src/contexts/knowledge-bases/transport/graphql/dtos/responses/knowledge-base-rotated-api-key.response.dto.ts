import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('KnowledgeBaseRotatedApiKeyResponseDto')
export class KnowledgeBaseRotatedApiKeyResponseDto {
  @Field(() => String, {
    description:
      'New plaintext API key — shown only in this response. The previous key stops working immediately.',
  })
  apiKey!: string;
}
