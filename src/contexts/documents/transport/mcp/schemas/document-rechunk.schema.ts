import { z } from 'zod';

/** Input schema for the `document_rechunk` MCP tool. */
export const documentRechunkSchema = {
  id: z.string().uuid().describe('Id of the document to rechunk'),
};
