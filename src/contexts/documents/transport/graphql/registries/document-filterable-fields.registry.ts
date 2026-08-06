import { FilterFieldRegistry } from '@sisques-labs/nestjs-kit';

import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentQueryableField } from '@contexts/documents/transport/graphql/enums/document-queryable-field.enum';

export const documentFilterableFields: FilterFieldRegistry<DocumentQueryableField> =
  {
    [DocumentQueryableField.ID]: { type: 'uuid' },
    [DocumentQueryableField.TITLE]: { type: 'string' },
    [DocumentQueryableField.STATUS]: { type: 'enum', enum: DocumentStatusEnum },
    [DocumentQueryableField.CREATED_AT]: { type: 'date' },
    [DocumentQueryableField.UPDATED_AT]: { type: 'date' },
  };
