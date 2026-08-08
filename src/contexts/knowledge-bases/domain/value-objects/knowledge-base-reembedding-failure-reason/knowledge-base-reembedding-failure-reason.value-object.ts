import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class KnowledgeBaseReembeddingFailureReasonValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { allowEmpty: false, maxLength: 2000 });
  }
}
