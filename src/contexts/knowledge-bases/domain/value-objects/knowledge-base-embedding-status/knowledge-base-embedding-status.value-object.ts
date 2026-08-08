import { EnumValueObject } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseEmbeddingStatusEnum } from '@contexts/knowledge-bases/domain/enums/knowledge-base-embedding-status.enum';

export class KnowledgeBaseEmbeddingStatusValueObject extends EnumValueObject<
  typeof KnowledgeBaseEmbeddingStatusEnum
> {
  protected get enumObject() {
    return KnowledgeBaseEmbeddingStatusEnum;
  }
}
