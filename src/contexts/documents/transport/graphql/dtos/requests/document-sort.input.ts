import { InputType } from '@nestjs/graphql';
import { createSortInput } from '@sisques-labs/nestjs-kit/graphql';

import { DocumentQueryableField } from '@contexts/documents/transport/graphql/enums/document-queryable-field.enum';

@InputType('DocumentSortInput')
export class DocumentSortInput extends createSortInput(
  DocumentQueryableField,
  'Document',
) {}
