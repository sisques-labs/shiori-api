import { DynamicModule, Module, Type } from '@nestjs/common';

import { DocumentsModule } from './documents/documents.module';
import { KnowledgeBasesModule } from './knowledge-bases/knowledge-bases.module';
import { RetrievalModule } from './retrieval/retrieval.module';

// Register every bounded context module here as it's added, e.g.:
// const CONTEXT_MODULES = [OrdersModule, CustomersModule];
const CONTEXT_MODULES: (DynamicModule | Type<unknown>)[] = [
  KnowledgeBasesModule,
  DocumentsModule,
  RetrievalModule,
];

@Module({
  imports: [...CONTEXT_MODULES],
})
export class ContextsModule {}
