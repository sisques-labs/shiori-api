import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';

import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';

export const DOCUMENT_READ_REPOSITORY = Symbol('DOCUMENT_READ_REPOSITORY');

export type IDocumentReadRepository = IBaseReadRepository<DocumentViewModel>;
