import { KnowledgeBaseNameValueObject } from './knowledge-base-name.value-object';

describe('KnowledgeBaseNameValueObject', () => {
  it('accepts a valid name', () => {
    expect(new KnowledgeBaseNameValueObject('Docs').value).toBe('Docs');
  });

  it('rejects an empty string', () => {
    expect(() => new KnowledgeBaseNameValueObject('')).toThrow();
  });

  it('rejects a string longer than 100 characters', () => {
    expect(() => new KnowledgeBaseNameValueObject('a'.repeat(101))).toThrow();
  });

  it('accepts a 100-character string', () => {
    const name = 'a'.repeat(100);
    expect(new KnowledgeBaseNameValueObject(name).value).toBe(name);
  });
});
