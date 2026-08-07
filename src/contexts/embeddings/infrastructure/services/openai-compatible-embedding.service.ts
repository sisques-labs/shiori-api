import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { IEmbeddingPort } from '@contexts/embeddings/application/ports/embedding.port';
import { EmbeddingsConfig } from '@contexts/embeddings/infrastructure/config/embeddings.config';

interface OpenAiEmbeddingsResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

/**
 * Default IEmbeddingPort implementation — calls an OpenAI-compatible
 * `/embeddings` endpoint (works against OpenAI itself, Ollama, LM Studio,
 * or any other server implementing the same request/response shape).
 */
@Injectable()
export class OpenAiCompatibleEmbeddingService implements IEmbeddingPort {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<EmbeddingsConfig>('embeddings');
    this.baseUrl = config.embeddingBaseUrl;
    this.apiKey = config.embeddingApiKey;
    this.model = config.embeddingModel;
  }

  async embed(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text]);
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const { data } = await firstValueFrom(
      this.httpService.post<OpenAiEmbeddingsResponse>(
        `${this.baseUrl}/embeddings`,
        { input: texts, model: this.model },
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        },
      ),
    );

    return [...data.data]
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}
