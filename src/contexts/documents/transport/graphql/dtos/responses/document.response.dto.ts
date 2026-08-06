import { Field, ID, ObjectType } from '@nestjs/graphql';
import { BasePaginatedResultDto } from '@sisques-labs/nestjs-kit/graphql';

import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';

@ObjectType('DocumentResponseDto')
export class DocumentResponseDto {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  content!: string;

  @Field(() => DocumentStatusEnum)
  status!: string;

  @Field(() => String, { nullable: true })
  failureReason!: string | null;

  @Field(() => Number)
  chunkCount!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('PaginatedDocumentResultDto')
export class PaginatedDocumentResultDto extends BasePaginatedResultDto {
  @Field(() => [DocumentResponseDto])
  items!: DocumentResponseDto[];
}
