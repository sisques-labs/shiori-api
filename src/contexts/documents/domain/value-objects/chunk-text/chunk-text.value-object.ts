import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class ChunkTextValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { allowEmpty: false });
  }
}
