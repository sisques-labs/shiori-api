import { Injectable, Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { IMcpTool, McpTool } from '@sisques-labs/nestjs-kit/mcp';
import { DocumentFindByIdQuery } from '@contexts/documents/application/queries/document-find-by-id/document-find-by-id.query';

import { documentFindByIdSchema } from '../schemas/document-find-by-id.schema';

@McpTool()
@Injectable()
export class DocumentFindByIdMcpTool implements IMcpTool {
  private readonly logger = new Logger(DocumentFindByIdMcpTool.name);

  readonly name = 'document_find_by_id';
  readonly title = 'Find document by id';
  readonly description =
    'Returns a single document by its id, or null if it does not exist.';
  readonly inputSchema = documentFindByIdSchema;

  constructor(private readonly queryBus: QueryBus) {}

  async execute(args: Record<string, unknown>): Promise<CallToolResult> {
    const { id } = args as { id: string };
    this.logger.log(`Finding document by id: ${id}`);

    const result = await this.queryBus.execute(
      new DocumentFindByIdQuery({ id }),
    );

    return {
      content: [{ type: 'text', text: JSON.stringify(result ?? null) }],
    };
  }
}
