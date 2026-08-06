import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { IMcpContextBuilder } from '@sisques-labs/nestjs-kit/mcp';
import { Request } from 'express';

import { KnowledgeBaseFindByApiKeyHashQuery } from '@contexts/knowledge-bases/application/queries/knowledge-base-find-by-api-key-hash/knowledge-base-find-by-api-key-hash.query';
import { KnowledgeBaseUnauthorizedException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-unauthorized.exception';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';
import { HashApiKeyService } from '@core/tenancy/hash-api-key.service';

import { IMcpToolContext } from './mcp-context.interface';

const API_KEY_HEADER = 'x-api-key';

/**
 * Builds the MCP tool context the same way `KnowledgeBaseApiKeyGuard`
 * authenticates ordinary REST/GraphQL requests: an `X-API-Key` header,
 * resolved to its owning knowledge base. See
 * `McpModule.forRoot({ contextBuilder: McpContextBuilder })` in `CoreModule`.
 */
@Injectable()
export class McpContextBuilder implements IMcpContextBuilder<IMcpToolContext> {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly hashApiKey: HashApiKeyService,
  ) {}

  async build(req: Request): Promise<IMcpToolContext> {
    const apiKey = req.headers[API_KEY_HEADER] as string | undefined;
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

    return { knowledgeBaseId: knowledgeBase.id };
  }
}
