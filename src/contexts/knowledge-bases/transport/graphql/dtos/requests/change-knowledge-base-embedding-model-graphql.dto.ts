import { Field, InputType } from '@nestjs/graphql';
import { IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class ChangeKnowledgeBaseEmbeddingModelGraphQLDto {
  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  embeddingModel!: string;
}
