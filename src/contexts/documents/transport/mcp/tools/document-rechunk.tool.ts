import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { IMcpTool, McpTool } from '@sisques-labs/nestjs-kit/mcp';
import { RechunkDocumentCommand } from '@contexts/documents/application/commands/rechunk-document/rechunk-document.command';

import { documentRechunkSchema } from '../schemas/document-rechunk.schema';

@McpTool()
@Injectable()
export class DocumentRechunkMcpTool implements IMcpTool {
  private readonly logger = new Logger(DocumentRechunkMcpTool.name);

  readonly name = 'document_rechunk';
  readonly title = 'Rechunk document';
  readonly description =
    'Forces a re-chunk of a document under its current content, without requiring a content change. Use to recover a document whose chunks are missing or stale despite a CHUNKED status.';
  readonly inputSchema = documentRechunkSchema;

  constructor(private readonly commandBus: CommandBus) {}

  async execute(args: Record<string, unknown>): Promise<CallToolResult> {
    const { id } = args as { id: string };
    this.logger.log(`Requesting rechunk for document: ${id}`);

    await this.commandBus.execute(new RechunkDocumentCommand({ id }));

    return {
      content: [{ type: 'text', text: JSON.stringify({ success: true, id }) }],
    };
  }
}
