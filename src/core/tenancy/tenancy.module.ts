import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { HashApiKeyService } from './hash-api-key.service';
import { KnowledgeBaseApiKeyGuard } from './knowledge-base-api-key.guard';
import { KnowledgeBaseContextInterceptor } from './knowledge-base-context.interceptor';
import { KnowledgeBaseContext } from './knowledge-base-context.service';

/**
 * @Global() so every context can `@UseGuards(KnowledgeBaseApiKeyGuard)` and
 * inject `KnowledgeBaseContext` without importing KnowledgeBasesModule —
 * these are cross-cutting tenancy infrastructure, not knowledge-bases'
 * own CRUD surface. KnowledgeBaseApiKeyGuard itself still dispatches
 * `KnowledgeBaseFindByApiKeyHashQuery` (from `@contexts/knowledge-bases/`)
 * via the global QueryBus — src/core/ is exempt from the boundaries
 * ESLint rule (`boundaries/include` only covers `src/contexts/**`), same
 * precedent as `core/filters/base-exception.filter.ts` registering
 * `resolveKnowledgeBasesExceptionStatus`.
 */
const PROVIDERS = [
  KnowledgeBaseContext,
  HashApiKeyService,
  KnowledgeBaseApiKeyGuard,
  { provide: APP_INTERCEPTOR, useClass: KnowledgeBaseContextInterceptor },
];

const EXPORTS = [
  KnowledgeBaseContext,
  HashApiKeyService,
  KnowledgeBaseApiKeyGuard,
];

@Global()
@Module({
  providers: [...PROVIDERS],
  exports: [...EXPORTS],
})
export class TenancyModule {}
