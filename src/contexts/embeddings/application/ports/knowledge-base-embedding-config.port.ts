import { IKnowledgeBaseEmbeddingConfig } from '@contexts/embeddings/application/ports/knowledge-base-embedding-config.interface';

export const KNOWLEDGE_BASE_EMBEDDING_CONFIG_PORT = Symbol(
  'KNOWLEDGE_BASE_EMBEDDING_CONFIG_PORT',
);

/**
 * Hexagonal seam over `knowledge-bases`. Implemented by
 * `infrastructure/adapters/knowledge-base-embedding-config.adapter.ts`,
 * which dispatches `knowledge-bases`' `KnowledgeBaseFindByIdQuery` through
 * the global QueryBus — this context never imports `knowledge-bases`'
 * module or repository tokens directly. Only the embed pipeline and search
 * resolve this port — deletes do not (see design.md).
 */
export interface IKnowledgeBaseEmbeddingConfigPort {
  getByKnowledgeBaseId(
    knowledgeBaseId: string,
  ): Promise<IKnowledgeBaseEmbeddingConfig>;
}
