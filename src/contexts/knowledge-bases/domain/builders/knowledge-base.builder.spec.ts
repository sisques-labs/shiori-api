import {
  FieldIsRequiredException,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseBuilder } from './knowledge-base.builder';

describe('KnowledgeBaseBuilder', () => {
  let builder: KnowledgeBaseBuilder;

  beforeEach(() => {
    builder = new KnowledgeBaseBuilder();
  });

  function withValidFields(b: KnowledgeBaseBuilder): KnowledgeBaseBuilder {
    const now = new Date();
    return b
      .withId(UuidValueObject.generate().value)
      .withName('Docs')
      .withApiKeyHash('a'.repeat(64))
      .withCreatedAt(now)
      .withUpdatedAt(now);
  }

  it('builds an aggregate with valid fields', () => {
    const knowledgeBase = withValidFields(builder).build();
    expect(knowledgeBase.name.value).toBe('Docs');
    expect(knowledgeBase.description).toBeNull();
  });

  it('builds a view model with valid fields', () => {
    const viewModel = withValidFields(builder).buildViewModel();
    expect(viewModel.name).toBe('Docs');
    expect(viewModel.description).toBeNull();
  });

  it('includes description when provided', () => {
    const knowledgeBase = withValidFields(builder)
      .withDescription('Internal')
      .build();
    expect(knowledgeBase.description?.value).toBe('Internal');
  });

  it('throws when name is missing', () => {
    const b = new KnowledgeBaseBuilder()
      .withId(UuidValueObject.generate().value)
      .withApiKeyHash('a'.repeat(64))
      .withCreatedAt(new Date())
      .withUpdatedAt(new Date());

    expect(() => b.build()).toThrow(FieldIsRequiredException);
  });

  it('throws when apiKeyHash is missing', () => {
    const b = new KnowledgeBaseBuilder()
      .withId(UuidValueObject.generate().value)
      .withName('Docs')
      .withCreatedAt(new Date())
      .withUpdatedAt(new Date());

    expect(() => b.build()).toThrow(FieldIsRequiredException);
  });
});
