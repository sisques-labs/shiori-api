import { VectorValueObject } from '@sisques-labs/nestjs-kit';

/**
 * Dimension is no longer a fixed global constant — every model in the
 * registry may produce a different-width vector, so the caller (the
 * builder, ultimately the pipeline/re-embed processor resolving the
 * Knowledge Base's current model) MUST pass the correct dimension per
 * instance. See design.md's "Model Registry" / "Normalized storage".
 */
export class EmbeddingVectorValueObject extends VectorValueObject {
  constructor(value: number[], dimensions: number) {
    super(value, { dimensions });
  }
}
