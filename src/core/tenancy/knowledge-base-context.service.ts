import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

import { KnowledgeBaseContextMissingException } from './exceptions/knowledge-base-context-missing.exception';

@Injectable()
export class KnowledgeBaseContext {
  private readonly als = new AsyncLocalStorage<{ knowledgeBaseId: string }>();

  run<T>(knowledgeBaseId: string, fn: () => T): T {
    return this.als.run({ knowledgeBaseId }, fn);
  }

  get(): string | undefined {
    return this.als.getStore()?.knowledgeBaseId;
  }

  require(): string {
    const knowledgeBaseId = this.get();
    if (!knowledgeBaseId) throw new KnowledgeBaseContextMissingException();
    return knowledgeBaseId;
  }
}
