import { DateValueObject } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseDescriptionValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-description/knowledge-base-description.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

import { KnowledgeBaseAggregate } from './knowledge-base.aggregate';

function buildAggregate(): KnowledgeBaseAggregate {
  const now = new Date();
  return new KnowledgeBaseAggregate({
    id: KnowledgeBaseIdValueObject.generate() as KnowledgeBaseIdValueObject,
    name: new KnowledgeBaseNameValueObject('Docs'),
    description: null,
    apiKeyHash: new KnowledgeBaseApiKeyHashValueObject('a'.repeat(64)),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('KnowledgeBaseAggregate', () => {
  it('create() emits KnowledgeBaseCreated', () => {
    const knowledgeBase = buildAggregate();
    knowledgeBase.create();

    const events = knowledgeBase.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].constructor.name).toBe('KnowledgeBaseCreatedEvent');
  });

  it('update() replaces name/description and emits KnowledgeBaseUpdated', () => {
    const knowledgeBase = buildAggregate();
    knowledgeBase.update({ name: new KnowledgeBaseNameValueObject('Docs v2') });

    expect(knowledgeBase.name.value).toBe('Docs v2');
    const events = knowledgeBase.getUncommittedEvents();
    expect(events[events.length - 1].constructor.name).toBe(
      'KnowledgeBaseUpdatedEvent',
    );
  });

  it('update() with description replaces it', () => {
    const knowledgeBase = buildAggregate();
    knowledgeBase.update({
      description: new KnowledgeBaseDescriptionValueObject('Updated'),
    });

    expect(knowledgeBase.description?.value).toBe('Updated');
  });

  it('update() emits KnowledgeBaseNameChanged when the name changes', () => {
    const knowledgeBase = buildAggregate();
    knowledgeBase.update({ name: new KnowledgeBaseNameValueObject('Docs v2') });

    const events = knowledgeBase.getUncommittedEvents();
    const nameChanged = events.find(
      (event) => event.constructor.name === 'KnowledgeBaseNameChangedEvent',
    ) as any;
    expect(nameChanged).toBeDefined();
    expect(nameChanged.data).toEqual({
      id: knowledgeBase.id.value,
      oldValue: 'Docs',
      newValue: 'Docs v2',
    });
  });

  it('update() does not emit KnowledgeBaseNameChanged when the name is unchanged', () => {
    const knowledgeBase = buildAggregate();
    knowledgeBase.update({ name: new KnowledgeBaseNameValueObject('Docs') });

    const events = knowledgeBase.getUncommittedEvents();
    expect(
      events.some(
        (event) => event.constructor.name === 'KnowledgeBaseNameChangedEvent',
      ),
    ).toBe(false);
  });

  it('update() emits KnowledgeBaseDescriptionChanged when the description changes', () => {
    const knowledgeBase = buildAggregate();
    knowledgeBase.update({
      description: new KnowledgeBaseDescriptionValueObject('Updated'),
    });

    const events = knowledgeBase.getUncommittedEvents();
    const descriptionChanged = events.find(
      (event) =>
        event.constructor.name === 'KnowledgeBaseDescriptionChangedEvent',
    ) as any;
    expect(descriptionChanged).toBeDefined();
    expect(descriptionChanged.data).toEqual({
      id: knowledgeBase.id.value,
      oldValue: null,
      newValue: 'Updated',
    });
  });

  it('delete() emits KnowledgeBaseDeleted', () => {
    const knowledgeBase = buildAggregate();
    knowledgeBase.delete();

    const events = knowledgeBase.getUncommittedEvents();
    expect(events[events.length - 1].constructor.name).toBe(
      'KnowledgeBaseDeletedEvent',
    );
  });

  it('rotateApiKey() replaces the hash and emits KnowledgeBaseApiKeyRotated without leaking it', () => {
    const knowledgeBase = buildAggregate();
    const newHash = new KnowledgeBaseApiKeyHashValueObject('b'.repeat(64));

    knowledgeBase.rotateApiKey(newHash);

    expect(knowledgeBase.apiKeyHash.value).toBe('b'.repeat(64));
    const events = knowledgeBase.getUncommittedEvents();
    const rotated = events[events.length - 1] as any;
    expect(rotated.constructor.name).toBe('KnowledgeBaseApiKeyRotatedEvent');
    expect(rotated.data).toEqual({
      id: knowledgeBase.id.value,
      name: knowledgeBase.name.value,
      description: knowledgeBase.description?.value ?? null,
      createdAt: knowledgeBase.createdAt.value,
      updatedAt: knowledgeBase.updatedAt.value,
    });
    expect(rotated.data).not.toHaveProperty('apiKeyHash');
  });
});
