import { Inject, Injectable } from '@nestjs/common';

import { DocumentNotFoundException } from '@contexts/documents/domain/exceptions/document-not-found.exception';
import {
  DOCUMENT_READ_REPOSITORY,
  IDocumentReadRepository,
} from '@contexts/documents/domain/repositories/read/document-read.repository';
import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';

@Injectable()
export class AssertDocumentViewModelExistsService {
  constructor(
    @Inject(DOCUMENT_READ_REPOSITORY)
    private readonly readRepository: IDocumentReadRepository,
  ) {}

  async execute(id: string): Promise<DocumentViewModel> {
    const vm = await this.readRepository.findById(id);
    if (!vm) throw new DocumentNotFoundException(id);
    return vm;
  }
}
