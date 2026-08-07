import { NumberValueObject } from '@sisques-labs/nestjs-kit';

export class ChunkPositionValueObject extends NumberValueObject {
  constructor(value: number) {
    super(value, { min: 0, allowDecimals: false });
  }
}
