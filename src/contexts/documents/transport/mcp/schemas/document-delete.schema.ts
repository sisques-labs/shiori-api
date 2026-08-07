import { z } from 'zod';

/** Input schema for the `document_delete` MCP tool. */
export const documentDeleteSchema = {
  id: z.string().uuid().describe('Id of the document to delete'),
};
