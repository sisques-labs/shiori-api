import { VectorValueObject } from '@sisques-labs/nestjs-kit';

import { EMBEDDING_VECTOR_DIMENSIONS } from '@contexts/embeddings/domain/constants/embedding-vector-dimensions.constant';

export class EmbeddingVectorValueObject extends VectorValueObject {
  constructor(value: number[]) {
    super(value, { dimensions: EMBEDDING_VECTOR_DIMENSIONS });
  }
}
