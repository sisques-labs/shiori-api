import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class DocumentFailureReasonValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { allowEmpty: false });
  }
}
