import { DateValueObject } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseApiKeyHashValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-api-key-hash/knowledge-base-api-key-hash.value-object';
import { KnowledgeBaseDescriptionValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-description/knowledge-base-description.value-object';
import { KnowledgeBaseIdValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-id/knowledge-base-id.value-object';
import { KnowledgeBaseNameValueObject } from '@contexts/knowledge-bases/domain/value-objects/knowledge-base-name/knowledge-base-name.value-object';

export interface IKnowledgeBase {
  id: KnowledgeBaseIdValueObject;
  name: KnowledgeBaseNameValueObject;
  description: KnowledgeBaseDescriptionValueObject | null;
  apiKeyHash: KnowledgeBaseApiKeyHashValueObject;
  createdAt: DateValueObject;
  updatedAt: DateValueObject;
}
