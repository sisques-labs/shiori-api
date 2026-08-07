import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class KnowledgeBaseDescriptionValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { maxLength: 2000, allowEmpty: true });
  }
}
