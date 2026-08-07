import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';

import { TenancyModule } from '@core/tenancy/tenancy.module';

import { EMBEDDING_SEARCH_PORT } from './application/ports/embedding-search.port';
import { RetrievalSearchQueryHandler } from './application/queries/retrieval-search/retrieval-search.handler';
import { EmbeddingSearchAdapter } from './infrastructure/adapters/embedding-search.adapter';
import { retrievalConfig } from './infrastructure/config/retrieval.config';
import { RetrievalGraphQLMapper } from './transport/graphql/mappers/retrieval/retrieval.mapper';
import { RetrievalQueriesResolver } from './transport/graphql/resolvers/retrieval-queries.resolver';
import { RetrievalSearchMcpTool } from './transport/mcp/tools/retrieval-search.tool';
import { RetrievalController } from './transport/rest/controllers/retrieval.controller';
import { RetrievalRestMapper } from './transport/rest/mappers/retrieval/retrieval.mapper';

const QUERY_HANDLERS = [RetrievalSearchQueryHandler];

const INFRASTRUCTURE_PORTS = [
  { provide: EMBEDDING_SEARCH_PORT, useClass: EmbeddingSearchAdapter },
];

const REST_CONTROLLERS = [RetrievalController];
const REST_PROVIDERS = [RetrievalRestMapper];
const GRAPHQL_PROVIDERS = [RetrievalQueriesResolver, RetrievalGraphQLMapper];
const MCP_TOOLS = [RetrievalSearchMcpTool];

const TRANSPORT_PROVIDERS = [
  ...REST_PROVIDERS,
  ...GRAPHQL_PROVIDERS,
  ...MCP_TOOLS,
];

@Module({
  imports: [
    CqrsModule,
    TenancyModule,
    ConfigModule.forFeature(retrievalConfig),
  ],
  controllers: [...REST_CONTROLLERS],
  providers: [
    ...QUERY_HANDLERS,
    ...INFRASTRUCTURE_PORTS,
    ...TRANSPORT_PROVIDERS,
  ],
  exports: [],
})
export class RetrievalModule {}
