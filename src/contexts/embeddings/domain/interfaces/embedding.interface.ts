import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { EmbeddingChunkPositionValueObject } from '@contexts/embeddings/domain/value-objects/embedding-chunk-position/embedding-chunk-position.value-object';
import { EmbeddingChunkTextValueObject } from '@contexts/embeddings/domain/value-objects/embedding-chunk-text/embedding-chunk-text.value-object';
import { EmbeddingIdValueObject } from '@contexts/embeddings/domain/value-objects/embedding-id/embedding-id.value-object';
import { EmbeddingModelValueObject } from '@contexts/embeddings/domain/value-objects/embedding-model/embedding-model.value-object';
import { EmbeddingVectorValueObject } from '@contexts/embeddings/domain/value-objects/embedding-vector/embedding-vector.value-object';

export interface IEmbedding {
  id: EmbeddingIdValueObject;
  knowledgeBaseId: UuidValueObject;
  documentId: UuidValueObject;
  chunkId: UuidValueObject;
  chunkText: EmbeddingChunkTextValueObject;
  chunkPosition: EmbeddingChunkPositionValueObject;
  embedding: EmbeddingVectorValueObject;
  model: EmbeddingModelValueObject;
  createdAt: DateValueObject;
}
