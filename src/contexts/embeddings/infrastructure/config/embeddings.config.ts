import { registerAs } from '@nestjs/config';

export interface EmbeddingsConfig {
  embeddingBaseUrl: string;
  embeddingApiKey: string;
}

export const embeddingsConfig = registerAs(
  'embeddings',
  (): EmbeddingsConfig => ({
    embeddingBaseUrl:
      process.env.EMBEDDINGS_BASE_URL ?? 'https://api.openai.com/v1',
    embeddingApiKey: process.env.EMBEDDINGS_API_KEY ?? '',
  }),
);
