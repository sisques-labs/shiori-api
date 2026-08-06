import { SetMetadata } from '@nestjs/common';

export const SKIP_KNOWLEDGE_BASE_AUTH_KEY = 'skipKnowledgeBaseAuth';

export const SkipKnowledgeBaseAuth = () =>
  SetMetadata(SKIP_KNOWLEDGE_BASE_AUTH_KEY, true);
