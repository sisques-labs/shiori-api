import { z } from 'zod';

/** Input schema for the `document_find_by_id` MCP tool. */
export const documentFindByIdSchema = {
  id: z.string().uuid().describe('Id of the document'),
};
