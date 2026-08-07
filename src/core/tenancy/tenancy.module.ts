import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { HashApiKeyCommandHandler } from './hash-api-key.command-handler';
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
 *
 * TODO: reformat to group providers/exports into named const arrays,
 * matching `knowledge-bases.module.ts`'s style, instead of inlining them
 * directly here.
 */
@Global()
@Module({
  imports: [CqrsModule],
  providers: [
    KnowledgeBaseContext,
    HashApiKeyService,
    HashApiKeyCommandHandler,
    KnowledgeBaseApiKeyGuard,
    { provide: APP_INTERCEPTOR, useClass: KnowledgeBaseContextInterceptor },
  ],
  exports: [KnowledgeBaseContext, HashApiKeyService, KnowledgeBaseApiKeyGuard],
})
export class TenancyModule {}
