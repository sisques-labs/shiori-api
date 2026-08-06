import { Field, InputType } from '@nestjs/graphql';
import { BaseFindByCriteriaInput } from '@sisques-labs/nestjs-kit/graphql';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';

import { DocumentFilterInput } from '@contexts/documents/transport/graphql/dtos/requests/document-filter.input';
import { DocumentSortInput } from '@contexts/documents/transport/graphql/dtos/requests/document-sort.input';

@InputType('DocumentFindByCriteriaRequestDto')
export class DocumentFindByCriteriaRequestDto extends BaseFindByCriteriaInput {
  @Field(() => [DocumentFilterInput], {
    nullable: true,
    description: 'The filters to find by',
    defaultValue: [],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DocumentFilterInput)
  declare filters?: DocumentFilterInput[];

  @Field(() => [DocumentSortInput], {
    nullable: true,
    description: 'The sorts to find by',
    defaultValue: [],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DocumentSortInput)
  declare sorts?: DocumentSortInput[];
}
