import { Field, InputType } from '@nestjs/graphql';
import { IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class CreateDocumentGraphQLDto {
  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @Field(() => String)
  @IsString()
  @MinLength(1)
  content!: string;
}
