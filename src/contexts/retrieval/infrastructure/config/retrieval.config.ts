import { registerAs } from '@nestjs/config';

export interface RetrievalConfig {
  searchTopKDefault: number;
  searchTopKMax: number;
}

export const retrievalConfig = registerAs('retrieval', (): RetrievalConfig => ({
  searchTopKDefault: parseInt(
    process.env.RETRIEVAL_SEARCH_TOP_K_DEFAULT ?? '5',
    10,
  ),
  searchTopKMax: parseInt(process.env.RETRIEVAL_SEARCH_TOP_K_MAX ?? '20', 10),
}));
