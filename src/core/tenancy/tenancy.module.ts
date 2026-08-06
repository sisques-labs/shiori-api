import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { KnowledgeBaseContextInterceptor } from './knowledge-base-context.interceptor';
import { KnowledgeBaseContext } from './knowledge-base-context.service';

@Global()
@Module({
  providers: [
    KnowledgeBaseContext,
    { provide: APP_INTERCEPTOR, useClass: KnowledgeBaseContextInterceptor },
  ],
  exports: [KnowledgeBaseContext],
})
export class TenancyModule {}
