import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class CreateKnowledgeBaseGraphQLDto {
  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
