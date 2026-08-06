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
    const kb = buildAggregate();
    kb.create();

    const events = kb.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].constructor.name).toBe('KnowledgeBaseCreatedEvent');
  });

  it('update() replaces name/description and emits KnowledgeBaseUpdated', () => {
    const kb = buildAggregate();
    kb.update({ name: new KnowledgeBaseNameValueObject('Docs v2') });

    expect(kb.name.value).toBe('Docs v2');
    const events = kb.getUncommittedEvents();
    expect(events[events.length - 1].constructor.name).toBe(
      'KnowledgeBaseUpdatedEvent',
    );
  });

  it('update() with description replaces it', () => {
    const kb = buildAggregate();
    kb.update({
      description: new KnowledgeBaseDescriptionValueObject('Updated'),
    });

    expect(kb.description?.value).toBe('Updated');
  });

  it('delete() emits KnowledgeBaseDeleted', () => {
    const kb = buildAggregate();
    kb.delete();

    const events = kb.getUncommittedEvents();
    expect(events[events.length - 1].constructor.name).toBe(
      'KnowledgeBaseDeletedEvent',
    );
  });

  it('rotateApiKey() replaces the hash and emits KnowledgeBaseApiKeyRotated without leaking it', () => {
    const kb = buildAggregate();
    const newHash = new KnowledgeBaseApiKeyHashValueObject('b'.repeat(64));

    kb.rotateApiKey(newHash);

    expect(kb.apiKeyHash.value).toBe('b'.repeat(64));
    const events = kb.getUncommittedEvents();
    const rotated = events[events.length - 1] as any;
    expect(rotated.constructor.name).toBe('KnowledgeBaseApiKeyRotatedEvent');
    expect(rotated.data).toEqual({ id: kb.id.value, name: kb.name.value });
  });
});
