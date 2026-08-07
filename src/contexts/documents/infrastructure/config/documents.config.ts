import { registerAs } from '@nestjs/config';

export interface DocumentsConfig {
  maxContentLength: number;
  maxChunks: number;
}

export const documentsConfig = registerAs('documents', (): DocumentsConfig => ({
  maxContentLength: parseInt(
    process.env.DOCUMENTS_MAX_CONTENT_LENGTH ?? '500000',
    10,
  ),
  maxChunks: parseInt(process.env.DOCUMENTS_MAX_CHUNKS ?? '2000', 10),
}));
