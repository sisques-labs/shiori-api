import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class EmbeddingChunkTextValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { allowEmpty: false });
  }
}
