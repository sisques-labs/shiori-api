import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('EmbeddingModelResponseDto')
export class EmbeddingModelResponseDto {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  provider!: string;

  @Field(() => Int)
  dimensions!: number;
}
