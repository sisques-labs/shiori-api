import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { IMcpTool, McpTool } from '@sisques-labs/nestjs-kit/mcp';
import { DeleteDocumentCommand } from '@contexts/documents/application/commands/delete-document/delete-document.command';

import { documentDeleteSchema } from '../schemas/document-delete.schema';

@McpTool()
@Injectable()
export class DocumentDeleteMcpTool implements IMcpTool {
  private readonly logger = new Logger(DocumentDeleteMcpTool.name);

  readonly name = 'document_delete';
  readonly title = 'Delete document';
  readonly description =
    'Deletes a document and its chunks from the current knowledge base.';
  readonly inputSchema = documentDeleteSchema;

  constructor(private readonly commandBus: CommandBus) {}

  async execute(args: Record<string, unknown>): Promise<CallToolResult> {
    const { id } = args as { id: string };
    this.logger.log(`Deleting document: ${id}`);

    await this.commandBus.execute(new DeleteDocumentCommand({ id }));

    return {
      content: [{ type: 'text', text: JSON.stringify({ success: true, id }) }],
    };
  }
}
