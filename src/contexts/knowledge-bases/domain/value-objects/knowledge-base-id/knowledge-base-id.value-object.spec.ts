import { KnowledgeBaseIdValueObject } from './knowledge-base-id.value-object';

describe('KnowledgeBaseIdValueObject', () => {
  it('accepts a valid UUID', () => {
    const id = KnowledgeBaseIdValueObject.generate().value;
    expect(new KnowledgeBaseIdValueObject(id).value).toBe(id);
  });

  it('rejects a non-UUID string', () => {
    expect(() => new KnowledgeBaseIdValueObject('not-a-uuid')).toThrow();
  });
});
