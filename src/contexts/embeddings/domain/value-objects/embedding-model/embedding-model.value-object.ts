import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class EmbeddingModelValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { allowEmpty: false, maxLength: 100 });
  }
}
