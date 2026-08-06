import { FilterOperator } from '@sisques-labs/nestjs-kit';
import { FilterValidationPipe } from '@sisques-labs/nestjs-kit/graphql';

import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentQueryableField } from '@contexts/documents/transport/graphql/enums/document-queryable-field.enum';
import { documentFilterableFields } from '@contexts/documents/transport/graphql/registries/document-filterable-fields.registry';

describe('documentFilterableFields', () => {
  const pipe = new FilterValidationPipe(documentFilterableFields);

  it('has an entry for every DocumentQueryableField value', () => {
    for (const field of Object.values(DocumentQueryableField)) {
      expect(documentFilterableFields[field]).toBeDefined();
    }
  });

  it('accepts an EQUALS filter on status with a real enum value', () => {
    const input = {
      filters: [
        {
          field: DocumentQueryableField.STATUS,
          operator: FilterOperator.EQUALS,
          value: DocumentStatusEnum.CHUNKED,
        },
      ],
    };

    expect(() => pipe.transform(input)).not.toThrow();
  });

  it('rejects a status value outside the enum', () => {
    const input = {
      filters: [
        {
          field: DocumentQueryableField.STATUS,
          operator: FilterOperator.EQUALS,
          value: 'ARCHIVED',
        },
      ],
    };

    expect(() => pipe.transform(input)).toThrow(/expected one of/);
  });

  it('rejects a filter on a field outside the whitelist (e.g. knowledgeBaseId)', () => {
    const input = {
      filters: [
        {
          field: 'knowledgeBaseId',
          operator: FilterOperator.EQUALS,
          value: 'x',
        },
      ],
    };

    expect(() => pipe.transform(input)).toThrow(/Unknown filter field/);
  });
});
