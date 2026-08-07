import { StringValueObject } from '@sisques-labs/nestjs-kit';

export class DocumentTitleValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { minLength: 1, maxLength: 255, allowEmpty: false });
  }
}
