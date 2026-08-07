import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

@InputType()
export class RetrievalSearchGraphQLDto {
  @Field(() => String)
  @IsString()
  @MinLength(1)
  query!: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  topK?: number;
}
