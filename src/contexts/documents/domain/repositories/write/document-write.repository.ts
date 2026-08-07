import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';

export const DOCUMENT_WRITE_REPOSITORY = Symbol('DOCUMENT_WRITE_REPOSITORY');

export type IDocumentWriteRepository = IBaseWriteRepository<DocumentAggregate>;
