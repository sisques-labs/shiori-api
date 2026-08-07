import { Field, ID, ObjectType } from '@nestjs/graphql';

/** Never includes apiKeyHash or apiKey. */
@ObjectType('KnowledgeBaseResponseDto')
export class KnowledgeBaseResponseDto {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
