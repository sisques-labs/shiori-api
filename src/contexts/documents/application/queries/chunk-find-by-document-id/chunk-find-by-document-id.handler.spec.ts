import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { ChunkAggregate } from '@contexts/documents/domain/aggregates/chunk.aggregate';
import { ChunkBuilder } from '@contexts/documents/domain/builders/chunk.builder';
import { IChunkWriteRepository } from '@contexts/documents/domain/repositories/write/chunk-write.repository';

import { ChunkFindByDocumentIdQuery } from './chunk-find-by-document-id.query';
import { ChunkFindByDocumentIdQueryHandler } from './chunk-find-by-document-id.handler';

describe('ChunkFindByDocumentIdQueryHandler', () => {
  let chunkWriteRepository: jest.Mocked<IChunkWriteRepository>;
  let handler: ChunkFindByDocumentIdQueryHandler;
  let documentId: string;
  let knowledgeBaseId: string;

  beforeEach(() => {
    documentId = UuidValueObject.generate().value;
    knowledgeBaseId = UuidValueObject.generate().value;

    chunkWriteRepository = {
      saveMany: jest.fn(),
      deleteByDocumentId: jest.fn(),
      findByDocumentId: jest.fn(),
    };

    handler = new ChunkFindByDocumentIdQueryHandler(chunkWriteRepository);
  });

  function buildChunk(position: number, text: string): ChunkAggregate {
    return new ChunkBuilder()
      .withId(UuidValueObject.generate().value)
      .withDocumentId(documentId)
      .withKnowledgeBaseId(knowledgeBaseId)
      .withPosition(position)
      .withText(text)
      .withCreatedAt(new Date())
      .build();
  }

  it('maps ChunkAggregate[] to the flat {id, text, position}[] shape', async () => {
    const chunkOne = buildChunk(0, 'first');
    const chunkTwo = buildChunk(1, 'second');
    chunkWriteRepository.findByDocumentId.mockResolvedValue([
      chunkOne,
      chunkTwo,
    ]);

    const result = await handler.execute(
      new ChunkFindByDocumentIdQuery({ documentId }),
    );

    expect(chunkWriteRepository.findByDocumentId).toHaveBeenCalledWith(
      documentId,
    );
    expect(result).toEqual([
      { id: chunkOne.id.value, text: 'first', position: 0 },
      { id: chunkTwo.id.value, text: 'second', position: 1 },
    ]);
  });

  it('returns an empty array when the document has no chunks', async () => {
    chunkWriteRepository.findByDocumentId.mockResolvedValue([]);

    const result = await handler.execute(
      new ChunkFindByDocumentIdQuery({ documentId }),
    );

    expect(result).toEqual([]);
  });
});
