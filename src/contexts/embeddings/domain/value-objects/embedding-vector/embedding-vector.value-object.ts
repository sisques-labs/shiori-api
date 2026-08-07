import { FieldIsRequiredException } from '@sisques-labs/nestjs-kit';

import { InvalidEmbeddingVectorDimensionException } from '@contexts/embeddings/domain/exceptions/invalid-embedding-vector-dimension.exception';

/** Fixed by the `embeddings.embedding` pgvector column width — see design.md. */
export const EMBEDDING_VECTOR_DIMENSIONS = 1536;

/**
 * No fitting base class in `@sisques-labs/nestjs-kit` for an array-shaped
 * value (only string/number/uuid/enum/date) — hand-rolled, mirroring the
 * kit's own VO shape (constructor validates, `.value` getter exposes the
 * primitive).
 */
export class EmbeddingVectorValueObject {
  private readonly _value: readonly number[];

  constructor(value: number[]) {
    if (value == null) throw new FieldIsRequiredException('embedding');
    if (value.length !== EMBEDDING_VECTOR_DIMENSIONS) {
      throw new InvalidEmbeddingVectorDimensionException(
        value.length,
        EMBEDDING_VECTOR_DIMENSIONS,
      );
    }
    this._value = Object.freeze([...value]);
  }

  get value(): number[] {
    return [...this._value];
  }
}
