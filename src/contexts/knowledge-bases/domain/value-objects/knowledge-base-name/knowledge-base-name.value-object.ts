import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class KnowledgeBaseNameValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { minLength: 1, maxLength: 100, allowEmpty: false });
  }
}
