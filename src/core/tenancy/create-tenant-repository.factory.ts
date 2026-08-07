import { Repository } from 'typeorm';

import { KnowledgeBaseContext } from './knowledge-base-context.service';

/**
 * Wraps a TypeORM repository so `find`/`findOne`/`findAndCount`/`save`/`delete`
 * are automatically scoped to the current request's `knowledgeBaseId`
 * (read from `KnowledgeBaseContext`). Entities using this MUST have a
 * `knowledgeBaseId` column. `createQueryBuilder` is NOT intercepted — callers
 * building their own query must apply the tenant filter explicitly.
 */
export function createTenantRepository<E extends { knowledgeBaseId: string }>(
  repo: Repository<E>,
  ctx: KnowledgeBaseContext,
): Repository<E> {
  return new Proxy(repo, {
    get(target, prop) {
      if (prop === 'findOne' || prop === 'find' || prop === 'findAndCount') {
        return (options: any = {}) =>
          (target as any)[prop]({
            ...options,
            where: { ...options.where, knowledgeBaseId: ctx.require() },
          });
      }
      if (prop === 'save') {
        return (entity: any) =>
          target.save({ ...entity, knowledgeBaseId: ctx.require() });
      }
      if (prop === 'delete') {
        return (criteria: any) => {
          const where =
            typeof criteria === 'string' || typeof criteria === 'number'
              ? { id: criteria, knowledgeBaseId: ctx.require() }
              : { ...criteria, knowledgeBaseId: ctx.require() };
          return target.delete(where);
        };
      }
      return Reflect.get(target, prop);
    },
  });
}
