export interface DocumentFindIdsByKnowledgeBaseIdQueryInput {
  knowledgeBaseId: string;
}

/**
 * Internal only — no transport surface. Dispatched exclusively by
 * `embeddings`' `DocumentChunkSourceAdapter` (via the global QueryBus) to
 * enumerate every document id for a Knowledge Base, needed by the re-embed
 * pipeline — the existing `ChunkFindByDocumentIdQuery` only supports
 * per-document lookup, sufficient for the normal embed pipeline but not
 * for "re-embed every document this tenant has".
 */
export class DocumentFindIdsByKnowledgeBaseIdQuery {
  public readonly knowledgeBaseId: string;

  constructor(input: DocumentFindIdsByKnowledgeBaseIdQueryInput) {
    this.knowledgeBaseId = input.knowledgeBaseId;
  }
}
