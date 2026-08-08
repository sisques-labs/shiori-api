/**
 * Static, code-defined source of truth for which embedding models this
 * service supports and what vector dimension each one produces. Nothing
 * ever computes a dimension at runtime — it's looked up here. See
 * design.md's "Model Registry" section.
 *
 * Adding a model that reuses an already-covered dimension is a one-line
 * addition to this array — no migration needed. Adding a model with a new
 * dimension needs both a registry entry here AND a migration creating
 * `embedding_vectors_{dimension}` (see `embedding-vector-entity.factory.ts`
 * and `src/contexts/embeddings/README.md`'s "Adding a new embedding model"
 * runbook) — with one hard constraint: pgvector's HNSW index does not
 * support columns wider than 2000 dimensions, so no model producing more
 * than 2000 dimensions can be added without a different indexing strategy
 * for its table (not solved here). This is why `text-embedding-3-large`
 * (3072 dimensions at its default output size) isn't in this registry —
 * OpenAI's API supports truncating it to a smaller size via a `dimensions`
 * request parameter, which could work here at e.g. 1024 or 1536, but that
 * would need its own registry entry with a distinct id (not modeled yet).
 */
export interface EmbeddingModelDefinition {
  /** Sent to the provider as-is, e.g. "text-embedding-3-small". */
  id: string;
  /** Informational only — never used to branch behavior. */
  provider: string;
  /** pgvector column width this model produces. */
  dimensions: number;
}

export const EMBEDDING_MODELS_REGISTRY: readonly EmbeddingModelDefinition[] = [
  { id: 'text-embedding-3-small', provider: 'openai', dimensions: 1536 },
  { id: 'text-embedding-ada-002', provider: 'openai', dimensions: 1536 },
  { id: 'nomic-embed-text', provider: 'ollama', dimensions: 768 },
  { id: 'mxbai-embed-large', provider: 'ollama', dimensions: 1024 },
];
