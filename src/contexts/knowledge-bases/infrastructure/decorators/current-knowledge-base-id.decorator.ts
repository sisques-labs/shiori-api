import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Extracts `req.knowledgeBaseId`, set by `KnowledgeBaseApiKeyGuard`. Every
 * authenticated route in this context operates on the caller's own
 * knowledge base — there is no `:id` param to accept instead (see
 * design.md "Why no :id parameter anywhere").
 */
export const CurrentKnowledgeBaseId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    if (ctx.getType<string>() === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(ctx);
      return gqlCtx.getContext<{ req: { knowledgeBaseId: string } }>().req
        .knowledgeBaseId;
    }
    const request = ctx
      .switchToHttp()
      .getRequest<{ knowledgeBaseId: string }>();
    return request.knowledgeBaseId;
  },
);
