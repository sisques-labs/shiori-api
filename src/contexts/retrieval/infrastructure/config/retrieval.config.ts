import { registerAs } from '@nestjs/config';

export interface RetrievalConfig {
  embeddingBaseUrl: string;
  embeddingApiKey: string;
  embeddingModel: string;
  searchTopKDefault: number;
  searchTopKMax: number;
}

export const retrievalConfig = registerAs('retrieval', (): RetrievalConfig => ({
  embeddingBaseUrl:
    process.env.RETRIEVAL_EMBEDDING_BASE_URL ?? 'https://api.openai.com/v1',
  embeddingApiKey: process.env.RETRIEVAL_EMBEDDING_API_KEY ?? '',
  embeddingModel:
    process.env.RETRIEVAL_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  searchTopKDefault: parseInt(
    process.env.RETRIEVAL_SEARCH_TOP_K_DEFAULT ?? '5',
    10,
  ),
  searchTopKMax: parseInt(process.env.RETRIEVAL_SEARCH_TOP_K_MAX ?? '20', 10),
}));
