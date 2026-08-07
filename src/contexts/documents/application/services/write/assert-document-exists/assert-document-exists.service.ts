import { Inject, Injectable } from '@nestjs/common';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import { DocumentNotFoundException } from '@contexts/documents/domain/exceptions/document-not-found.exception';
import {
  DOCUMENT_WRITE_REPOSITORY,
  IDocumentWriteRepository,
} from '@contexts/documents/domain/repositories/write/document-write.repository';
import { DocumentIdValueObject } from '@contexts/documents/domain/value-objects/document-id/document-id.value-object';

@Injectable()
export class AssertDocumentExistsService {
  constructor(
    @Inject(DOCUMENT_WRITE_REPOSITORY)
    private readonly writeRepository: IDocumentWriteRepository,
  ) {}

  async execute(id: DocumentIdValueObject): Promise<DocumentAggregate> {
    const document = await this.writeRepository.findById(id.value);
    if (!document) throw new DocumentNotFoundException(id.value);
    return document;
  }
}
