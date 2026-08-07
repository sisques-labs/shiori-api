import { Injectable, Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { IMcpTool, McpTool } from '@sisques-labs/nestjs-kit/mcp';
import { RetrievalSearchQuery } from '@contexts/retrieval/application/queries/retrieval-search/retrieval-search.query';
import { IMcpToolContext } from '@core/mcp/mcp-context.interface';

import { retrievalSearchSchema } from '../schemas/retrieval-search.schema';

@McpTool()
@Injectable()
export class RetrievalSearchMcpTool implements IMcpTool<IMcpToolContext> {
  private readonly logger = new Logger(RetrievalSearchMcpTool.name);

  readonly name = 'retrieval_search';
  readonly title = 'Search knowledge base';
  readonly description =
    "Semantic search over the current knowledge base's documents. Returns the most relevant chunks for a natural-language query.";
  readonly inputSchema = retrievalSearchSchema;

  constructor(private readonly queryBus: QueryBus) {}

  async execute(args: Record<string, unknown>): Promise<CallToolResult> {
    const { query, topK } = args as { query: string; topK?: number };
    this.logger.log(`Searching: "${query}"`);

    const results = await this.queryBus.execute(
      new RetrievalSearchQuery({ query, topK }),
    );

    return { content: [{ type: 'text', text: JSON.stringify(results) }] };
  }
}
