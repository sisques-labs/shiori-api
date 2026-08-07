import {
  DateValueObject,
  UuidValueObject,
  VectorValueObject,
} from '@sisques-labs/nestjs-kit';

import { EmbeddingChunkPositionValueObject } from '@contexts/embeddings/domain/value-objects/embedding-chunk-position/embedding-chunk-position.value-object';
import { EmbeddingChunkTextValueObject } from '@contexts/embeddings/domain/value-objects/embedding-chunk-text/embedding-chunk-text.value-object';
import { EmbeddingIdValueObject } from '@contexts/embeddings/domain/value-objects/embedding-id/embedding-id.value-object';
import { EmbeddingModelValueObject } from '@contexts/embeddings/domain/value-objects/embedding-model/embedding-model.value-object';

export interface IEmbedding {
  id: EmbeddingIdValueObject;
  knowledgeBaseId: UuidValueObject;
  documentId: UuidValueObject;
  chunkId: UuidValueObject;
  chunkText: EmbeddingChunkTextValueObject;
  chunkPosition: EmbeddingChunkPositionValueObject;
  embedding: VectorValueObject;
  model: EmbeddingModelValueObject;
  createdAt: DateValueObject;
  updatedAt: DateValueObject;
}
