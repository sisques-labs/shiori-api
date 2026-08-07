import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';
import { DocumentInvalidStatusTransitionException } from '@contexts/documents/domain/exceptions/document-invalid-status-transition.exception';
import { DocumentChunkCountValueObject } from '@contexts/documents/domain/value-objects/document-chunk-count/document-chunk-count.value-object';
import { DocumentContentValueObject } from '@contexts/documents/domain/value-objects/document-content/document-content.value-object';
import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';
import { DocumentStatusValueObject } from '@contexts/documents/domain/value-objects/document-status/document-status.value-object';
import { DocumentTitleValueObject } from '@contexts/documents/domain/value-objects/document-title/document-title.value-object';

import { DocumentAggregate } from './document.aggregate';

function buildAggregate(
  status: DocumentStatusEnum = DocumentStatusEnum.PENDING,
): DocumentAggregate {
  const now = new Date();
  return new DocumentAggregate({
    id: DocumentIdValueObject.generate() as DocumentIdValueObject,
    knowledgeBaseId: UuidValueObject.generate(),
    title: new DocumentTitleValueObject('Doc'),
    content: new DocumentContentValueObject('Some content'),
    status: new DocumentStatusValueObject(status),
    failureReason: null,
    chunkCount: new DocumentChunkCountValueObject(0),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('DocumentAggregate', () => {
  it('create() emits DocumentCreated', () => {
    const doc = buildAggregate();
    doc.create();

    const events = doc.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].constructor.name).toBe('DocumentCreatedEvent');
  });

  it('startChunking() transitions PENDING -> CHUNKING and emits DocumentChunkingStarted', () => {
    const doc = buildAggregate(DocumentStatusEnum.PENDING);
    doc.startChunking();

    expect(doc.status.value).toBe(DocumentStatusEnum.CHUNKING);
    const events = doc.getUncommittedEvents();
    expect(events[events.length - 1].constructor.name).toBe(
      'DocumentChunkingStartedEvent',
    );
  });

  it('startChunking() from a non-PENDING status throws', () => {
    const doc = buildAggregate(DocumentStatusEnum.CHUNKING);
    expect(() => doc.startChunking()).toThrow(
      DocumentInvalidStatusTransitionException,
    );
  });

  it('completeChunking() transitions CHUNKING -> CHUNKED, sets chunkCount, emits DocumentChunked', () => {
    const doc = buildAggregate(DocumentStatusEnum.CHUNKING);
    doc.completeChunking(5);

    expect(doc.status.value).toBe(DocumentStatusEnum.CHUNKED);
    expect(doc.chunkCount.value).toBe(5);
    expect(doc.failureReason).toBeNull();
    const events = doc.getUncommittedEvents();
    expect(events[events.length - 1].constructor.name).toBe(
      'DocumentChunkedEvent',
    );
  });

  it('completeChunking() from PENDING throws', () => {
    const doc = buildAggregate(DocumentStatusEnum.PENDING);
    expect(() => doc.completeChunking(1)).toThrow(
      DocumentInvalidStatusTransitionException,
    );
  });

  it('failChunking() transitions CHUNKING -> FAILED, sets failureReason, emits DocumentChunkingFailed', () => {
    const doc = buildAggregate(DocumentStatusEnum.CHUNKING);
    doc.failChunking('boom');

    expect(doc.status.value).toBe(DocumentStatusEnum.FAILED);
    expect(doc.failureReason?.value).toBe('boom');
    const events = doc.getUncommittedEvents();
    expect(events[events.length - 1].constructor.name).toBe(
      'DocumentChunkingFailedEvent',
    );
  });

  it('failChunking() from PENDING throws', () => {
    const doc = buildAggregate(DocumentStatusEnum.PENDING);
    expect(() => doc.failChunking('boom')).toThrow(
      DocumentInvalidStatusTransitionException,
    );
  });

  it('update() replaces title without touching status', () => {
    const doc = buildAggregate(DocumentStatusEnum.CHUNKED);
    doc.update({ title: new DocumentTitleValueObject('New title') });

    expect(doc.title.value).toBe('New title');
    expect(doc.status.value).toBe(DocumentStatusEnum.CHUNKED);
  });

  it('update() with content resets status to PENDING and clears chunkCount/failureReason', () => {
    const now = new Date();
    const doc = new DocumentAggregate({
      id: DocumentIdValueObject.generate() as DocumentIdValueObject,
      knowledgeBaseId: UuidValueObject.generate(),
      title: new DocumentTitleValueObject('Doc'),
      content: new DocumentContentValueObject('old'),
      status: new DocumentStatusValueObject(DocumentStatusEnum.FAILED),
      failureReason: null,
      chunkCount: new DocumentChunkCountValueObject(3),
      createdAt: new DateValueObject(now),
      updatedAt: new DateValueObject(now),
    });

    doc.update({ content: new DocumentContentValueObject('new content') });

    expect(doc.content.value).toBe('new content');
    expect(doc.status.value).toBe(DocumentStatusEnum.PENDING);
    expect(doc.chunkCount.value).toBe(0);
    expect(doc.failureReason).toBeNull();
    const events = doc.getUncommittedEvents();
    expect(events[events.length - 1].constructor.name).toBe(
      'DocumentUpdatedEvent',
    );
  });

  it('update() emits DocumentTitleChanged when the title changes', () => {
    const doc = buildAggregate();
    doc.update({ title: new DocumentTitleValueObject('New title') });

    const events = doc.getUncommittedEvents();
    const titleChanged = events.find(
      (event) => event.constructor.name === 'DocumentTitleChangedEvent',
    ) as any;
    expect(titleChanged).toBeDefined();
    expect(titleChanged.data).toEqual({
      id: doc.id.value,
      oldValue: 'Doc',
      newValue: 'New title',
    });
  });

  it('update() does not emit DocumentTitleChanged when the title is unchanged', () => {
    const doc = buildAggregate();
    doc.update({ title: new DocumentTitleValueObject('Doc') });

    const events = doc.getUncommittedEvents();
    expect(
      events.some(
        (event) => event.constructor.name === 'DocumentTitleChangedEvent',
      ),
    ).toBe(false);
  });

  it('update() emits DocumentContentChanged when the content changes', () => {
    const doc = buildAggregate();
    doc.update({ content: new DocumentContentValueObject('new content') });

    const events = doc.getUncommittedEvents();
    const contentChanged = events.find(
      (event) => event.constructor.name === 'DocumentContentChangedEvent',
    ) as any;
    expect(contentChanged).toBeDefined();
    expect(contentChanged.data).toEqual({
      id: doc.id.value,
      oldValue: 'Some content',
      newValue: 'new content',
    });
  });

  it('update() while CHUNKING throws', () => {
    const doc = buildAggregate(DocumentStatusEnum.CHUNKING);
    expect(() =>
      doc.update({ title: new DocumentTitleValueObject('X') }),
    ).toThrow(DocumentInvalidStatusTransitionException);
  });

  it('delete() emits DocumentDeleted', () => {
    const doc = buildAggregate();
    doc.delete();

    const events = doc.getUncommittedEvents();
    expect(events[events.length - 1].constructor.name).toBe(
      'DocumentDeletedEvent',
    );
  });
});
