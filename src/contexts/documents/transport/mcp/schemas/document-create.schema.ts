import { z } from 'zod';

/** Input schema for the `document_create` MCP tool. */
export const documentCreateSchema = {
  title: z.string().min(1).max(255).describe('Document title (1-255 chars)'),
  content: z.string().min(1).describe('Plain text or Markdown content'),
};
