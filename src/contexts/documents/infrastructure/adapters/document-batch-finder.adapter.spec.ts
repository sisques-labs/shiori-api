import { QueryBus } from '@nestjs/cqrs';
import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';

import { DocumentBatchFinderAdapter } from './document-batch-finder.adapter';

describe('DocumentBatchFinderAdapter', () => {
  let queryBus: jest.Mocked<QueryBus>;
  let adapter: DocumentBatchFinderAdapter;

  beforeEach(() => {
    queryBus = { execute: jest.fn() } as any;
    adapter = new DocumentBatchFinderAdapter(queryBus);
  });

  it('dispatches DocumentFindBatchQuery via the global QueryBus', async () => {
    const page = new PaginatedResult<DocumentAggregate>([], 0, 1, 100);
    queryBus.execute.mockResolvedValue(page);

    const result = await adapter.findBatch(1, 100);

    expect(result).toBe(page);
    expect(queryBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 100 }),
    );
  });
});
