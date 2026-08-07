import { Injectable, Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Criteria } from '@sisques-labs/nestjs-kit';

import { IMcpTool, McpTool } from '@sisques-labs/nestjs-kit/mcp';
import { DocumentFindByCriteriaQuery } from '@contexts/documents/application/queries/document-find-by-criteria/document-find-by-criteria.query';

import { documentFindByCriteriaSchema } from '../schemas/document-find-by-criteria.schema';

@McpTool()
@Injectable()
export class DocumentFindByCriteriaMcpTool implements IMcpTool {
  private readonly logger = new Logger(DocumentFindByCriteriaMcpTool.name);

  readonly name = 'document_find_by_criteria';
  readonly title = 'List documents';
  readonly description =
    'Returns a paginated list of documents in the current knowledge base.';
  readonly inputSchema = documentFindByCriteriaSchema;

  constructor(private readonly queryBus: QueryBus) {}

  async execute(args: Record<string, unknown>): Promise<CallToolResult> {
    const { page, perPage } = args as { page?: number; perPage?: number };
    this.logger.log(
      `Finding documents: page=${page ?? '-'} perPage=${perPage ?? '-'}`,
    );

    const pagination =
      page !== undefined && perPage !== undefined
        ? { page, perPage }
        : undefined;
    const criteria = new Criteria(undefined, undefined, pagination);

    const result = await this.queryBus.execute(
      new DocumentFindByCriteriaQuery({ criteria }),
    );

    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
}
