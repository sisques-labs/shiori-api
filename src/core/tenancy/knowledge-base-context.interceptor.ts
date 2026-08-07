import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';

import { KnowledgeBaseContext } from './knowledge-base-context.service';

/**
 * ALS Decision: KnowledgeBaseContext is populated here, not in the guard.
 * Guards resolve before the handler executes; an ALS run() opened in a
 * guard would close before the handler chain completes. This interceptor
 * wraps next.handle() so the ALS frame covers the full request lifecycle.
 */
@Injectable()
export class KnowledgeBaseContextInterceptor implements NestInterceptor {
  constructor(private readonly knowledgeBaseContext: KnowledgeBaseContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = this.getRequest(context);
    const knowledgeBaseId = req['knowledgeBaseId'] as string | undefined;

    if (!knowledgeBaseId) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      this.knowledgeBaseContext.run(knowledgeBaseId, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }

  private getRequest(context: ExecutionContext): Record<string, unknown> {
    if (context.getType<string>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext<{
        req: Record<string, unknown>;
      }>().req;
    }
    return context.switchToHttp().getRequest<Record<string, unknown>>();
  }
}
