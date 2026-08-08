import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';

import { DocumentViewModel } from '@contexts/documents/domain/view-models/document.view-model';

export const DOCUMENT_READ_REPOSITORY = Symbol('DOCUMENT_READ_REPOSITORY');

/**
 * `findIdsByKnowledgeBaseId` backs `embeddings`' re-embed pipeline (via
 * `documents`' internal-only `DocumentFindIdsByKnowledgeBaseIdQuery`) —
 * enumerates every document id for a Knowledge Base, unlike the
 * per-document lookups (`ChunkFindByDocumentIdQuery`) sufficient for the
 * normal embed pipeline.
 */
export interface IDocumentReadRepository extends IBaseReadRepository<DocumentViewModel> {
  findIdsByKnowledgeBaseId(knowledgeBaseId: string): Promise<string[]>;
}
