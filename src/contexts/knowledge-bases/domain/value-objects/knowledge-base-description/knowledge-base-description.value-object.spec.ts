import { KnowledgeBaseDescriptionValueObject } from './knowledge-base-description.value-object';

describe('KnowledgeBaseDescriptionValueObject', () => {
  it('accepts a valid description', () => {
    expect(new KnowledgeBaseDescriptionValueObject('Internal docs').value).toBe(
      'Internal docs',
    );
  });

  it('rejects a description longer than 2000 characters', () => {
    expect(
      () => new KnowledgeBaseDescriptionValueObject('a'.repeat(2001)),
    ).toThrow();
  });

  it('accepts a 2000-character description', () => {
    const description = 'a'.repeat(2000);
    expect(new KnowledgeBaseDescriptionValueObject(description).value).toBe(
      description,
    );
  });
});
