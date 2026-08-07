import { InputType } from '@nestjs/graphql';
import { createFilterInput } from '@sisques-labs/nestjs-kit/graphql';

import { DocumentQueryableField } from '@contexts/documents/transport/graphql/enums/document-queryable-field.enum';

@InputType('DocumentFilterInput')
export class DocumentFilterInput extends createFilterInput(
  DocumentQueryableField,
  'Document',
) {}
