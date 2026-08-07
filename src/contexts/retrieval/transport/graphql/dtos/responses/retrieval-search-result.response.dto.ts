import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('RetrievalSearchResultResponseDto')
export class RetrievalSearchResultResponseDto {
  @Field(() => ID)
  chunkId!: string;

  @Field(() => ID)
  documentId!: string;

  @Field(() => String)
  chunkText!: string;

  @Field(() => Int)
  chunkPosition!: number;

  @Field(() => Number)
  score!: number;
}
