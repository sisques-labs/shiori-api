import { IBaseMcpToolContext } from '@sisques-labs/nestjs-kit/mcp';

/**
 * shiori-api's MCP tool context: the knowledge base resolved from the
 * caller's `X-API-Key`, the same identity every other transport uses. Built
 * by {@link McpContextBuilder}.
 */
export interface IMcpToolContext extends IBaseMcpToolContext {
  readonly knowledgeBaseId: string;
}
