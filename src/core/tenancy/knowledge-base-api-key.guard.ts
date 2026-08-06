import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { QueryBus } from '@nestjs/cqrs';
import { Reflector } from '@nestjs/core';

import { KnowledgeBaseFindByApiKeyHashQuery } from '@contexts/knowledge-bases/application/queries/knowledge-base-find-by-api-key-hash/knowledge-base-find-by-api-key-hash.query';
import { HashApiKeyService } from '@contexts/knowledge-bases/application/services/write/hash-api-key/hash-api-key.service';
import { KnowledgeBaseUnauthorizedException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-unauthorized.exception';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';

import { SKIP_KNOWLEDGE_BASE_AUTH_KEY } from './skip-knowledge-base-auth.decorator';

const API_KEY_HEADER = 'x-api-key';

@Injectable()
export class KnowledgeBaseApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly queryBus: QueryBus,
    private readonly hashApiKey: HashApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_KNOWLEDGE_BASE_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const req = this.getRequest(context);

    const headers = req['headers'] as
      Record<string, string | string[] | undefined> | undefined;
    const apiKey = headers?.[API_KEY_HEADER] as string | undefined;
    if (!apiKey || apiKey.trim() === '') {
      throw new KnowledgeBaseUnauthorizedException();
    }

    const hash = this.hashApiKey.execute(apiKey);
    const knowledgeBase = await this.queryBus.execute<
      KnowledgeBaseFindByApiKeyHashQuery,
      KnowledgeBaseViewModel | null
    >(new KnowledgeBaseFindByApiKeyHashQuery({ hash }));

    if (!knowledgeBase) {
      throw new KnowledgeBaseUnauthorizedException();
    }

    req['knowledgeBaseId'] = knowledgeBase.id;
    return true;
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
