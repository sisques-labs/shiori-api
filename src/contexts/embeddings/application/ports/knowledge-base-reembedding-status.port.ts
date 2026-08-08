export const KNOWLEDGE_BASE_REEMBEDDING_STATUS_PORT = Symbol(
  'KNOWLEDGE_BASE_REEMBEDDING_STATUS_PORT',
);

/**
 * Hexagonal seam over `knowledge-bases`, used exclusively by
 * `ReembedKnowledgeBaseProcessor` to report the outcome of a re-embed run.
 * Implemented by
 * `infrastructure/adapters/knowledge-base-reembedding-status.adapter.ts`,
 * which dispatches `knowledge-bases`' internal
 * `CompleteKnowledgeBaseReembeddingCommand`/`FailKnowledgeBaseReembeddingCommand`
 * through the global CommandBus — this context never imports
 * `knowledge-bases`' module or command classes directly outside
 * `infrastructure/adapters/`.
 */
export interface IKnowledgeBaseReembeddingStatusPort {
  complete(knowledgeBaseId: string): Promise<void>;
  fail(knowledgeBaseId: string, reason: string): Promise<void>;
}
