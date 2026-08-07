import { registerEnumType } from '@nestjs/graphql';

import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentQueryableField } from '@contexts/documents/transport/graphql/enums/document-queryable-field.enum';

registerEnumType(DocumentStatusEnum, {
  name: 'DocumentStatus',
  description: 'Lifecycle status of a document in the chunking pipeline',
});

registerEnumType(DocumentQueryableField, {
  name: 'DocumentQueryableFieldEnum',
  description: 'The document fields that can be filtered/sorted on',
});
