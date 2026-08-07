import { QueryBus } from '@nestjs/cqrs';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { ChunkFindByDocumentIdQuery } from '@contexts/documents/application/queries/chunk-find-by-document-id/chunk-find-by-document-id.query';
import { ChunkFindByDocumentIdResult } from '@contexts/documents/application/queries/chunk-find-by-document-id/chunk-find-by-document-id.handler';

import { DocumentChunkSourceAdapter } from './document-chunk-source.adapter';

describe('DocumentChunkSourceAdapter', () => {
  let queryBus: jest.Mocked<QueryBus>;
  let adapter: DocumentChunkSourceAdapter;

  beforeEach(() => {
    queryBus = { execute: jest.fn() } as unknown as jest.Mocked<QueryBus>;
    adapter = new DocumentChunkSourceAdapter(queryBus);
  });

  it('dispatches a ChunkFindByDocumentIdQuery and maps the result', async () => {
    const documentId = UuidValueObject.generate().value;
    const results: ChunkFindByDocumentIdResult[] = [
      { id: 'chunk-1', text: 'first', position: 0 },
      { id: 'chunk-2', text: 'second', position: 1 },
    ];
    queryBus.execute.mockResolvedValue(results);

    const found = await adapter.findByDocumentId(documentId);

    expect(queryBus.execute).toHaveBeenCalledWith(
      expect.any(ChunkFindByDocumentIdQuery),
    );
    const dispatchedQuery = queryBus.execute.mock
      .calls[0][0] as ChunkFindByDocumentIdQuery;
    expect(dispatchedQuery.documentId).toBe(documentId);

    expect(found).toEqual([
      { id: 'chunk-1', text: 'first', position: 0 },
      { id: 'chunk-2', text: 'second', position: 1 },
    ]);
  });

  it('returns an empty array when there are no chunks', async () => {
    queryBus.execute.mockResolvedValue([]);

    const found = await adapter.findByDocumentId(
      UuidValueObject.generate().value,
    );

    expect(found).toEqual([]);
  });
});
