import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { IMcpTool, McpTool } from '@sisques-labs/nestjs-kit/mcp';
import { CreateDocumentCommand } from '@contexts/documents/application/commands/create-document/create-document.command';
import { CreateDocumentResult } from '@contexts/documents/application/commands/create-document/create-document.handler';
import { IMcpToolContext } from '@core/mcp/mcp-context.interface';

import { documentCreateSchema } from '../schemas/document-create.schema';

@McpTool()
@Injectable()
export class DocumentCreateMcpTool implements IMcpTool<IMcpToolContext> {
  private readonly logger = new Logger(DocumentCreateMcpTool.name);

  readonly name = 'document_create';
  readonly title = 'Create document';
  readonly description =
    'Creates a document in the current knowledge base and queues it for async chunking.';
  readonly inputSchema = documentCreateSchema;

  constructor(private readonly commandBus: CommandBus) {}

  async execute(
    args: Record<string, unknown>,
    context: IMcpToolContext,
  ): Promise<CallToolResult> {
    const { title, content } = args as { title: string; content: string };
    this.logger.log(`Creating document: ${title}`);

    const result = await this.commandBus.execute<
      CreateDocumentCommand,
      CreateDocumentResult
    >(
      new CreateDocumentCommand({
        knowledgeBaseId: context.knowledgeBaseId,
        title,
        content,
      }),
    );

    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
}
