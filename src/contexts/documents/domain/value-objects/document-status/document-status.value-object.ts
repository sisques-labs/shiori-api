import { EnumValueObject } from '@sisques-labs/nestjs-kit';

import { DocumentStatusEnum } from '@contexts/documents/domain/enums/document-status.enum';

export class DocumentStatusValueObject extends EnumValueObject<
  typeof DocumentStatusEnum
> {
  protected get enumObject() {
    return DocumentStatusEnum;
  }
}
