import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { ChunkIdValueObject } from '@contexts/documents/domain/value-objects/chunk-id/chunk-id.value-object';
import { ChunkPositionValueObject } from '@contexts/documents/domain/value-objects/chunk-position/chunk-position.value-object';
import { ChunkTextValueObject } from '@contexts/documents/domain/value-objects/chunk-text/chunk-text.value-object';

export interface IChunk {
  id: ChunkIdValueObject;
  documentId: UuidValueObject;
  knowledgeBaseId: UuidValueObject;
  position: ChunkPositionValueObject;
  text: ChunkTextValueObject;
  createdAt: DateValueObject;
}
