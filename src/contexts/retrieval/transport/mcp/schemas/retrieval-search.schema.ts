import { z } from 'zod';

/** Input schema for the `retrieval_search` MCP tool. */
export const retrievalSearchSchema = {
  query: z.string().min(1).describe('Natural-language search query'),
  topK: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe('Number of results to return'),
};
