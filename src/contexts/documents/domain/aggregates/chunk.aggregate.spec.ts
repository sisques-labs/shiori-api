import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { ChunkIdValueObject } from '@contexts/documents/domain/value-objects/chunk-id/chunk-id.value-object';
import { ChunkPositionValueObject } from '@contexts/documents/domain/value-objects/chunk-position/chunk-position.value-object';
import { ChunkTextValueObject } from '@contexts/documents/domain/value-objects/chunk-text/chunk-text.value-object';

import { ChunkAggregate } from './chunk.aggregate';

describe('ChunkAggregate', () => {
  it('hydrates from its constructor props with no domain events', () => {
    const now = new Date();
    const documentId = UuidValueObject.generate();
    const knowledgeBaseId = UuidValueObject.generate();

    const chunk = new ChunkAggregate({
      id: ChunkIdValueObject.generate() as ChunkIdValueObject,
      documentId,
      knowledgeBaseId,
      position: new ChunkPositionValueObject(2),
      text: new ChunkTextValueObject('some chunk text'),
      createdAt: new DateValueObject(now),
      updatedAt: new DateValueObject(now),
    });

    expect(chunk.documentId.value).toBe(documentId.value);
    expect(chunk.knowledgeBaseId.value).toBe(knowledgeBaseId.value);
    expect(chunk.position.value).toBe(2);
    expect(chunk.text.value).toBe('some chunk text');
    expect(chunk.createdAt.value).toBe(now);
    // ChunkAggregate extends BaseAggregate but emits no domain events.
    expect(chunk.getUncommittedEvents()).toEqual([]);
  });

  it('toPrimitives() returns the flat shape', () => {
    const now = new Date();
    const documentId = UuidValueObject.generate();
    const knowledgeBaseId = UuidValueObject.generate();
    const id = ChunkIdValueObject.generate() as ChunkIdValueObject;

    const chunk = new ChunkAggregate({
      id,
      documentId,
      knowledgeBaseId,
      position: new ChunkPositionValueObject(0),
      text: new ChunkTextValueObject('text'),
      createdAt: new DateValueObject(now),
      updatedAt: new DateValueObject(now),
    });

    expect(chunk.toPrimitives()).toEqual({
      id: id.value,
      documentId: documentId.value,
      knowledgeBaseId: knowledgeBaseId.value,
      position: 0,
      text: 'text',
      createdAt: now,
      updatedAt: now,
    });
  });
});
