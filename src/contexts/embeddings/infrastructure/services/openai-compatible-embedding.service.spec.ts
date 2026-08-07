import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';

import { EmbeddingsConfig } from '@contexts/embeddings/infrastructure/config/embeddings.config';

import { OpenAiCompatibleEmbeddingService } from './openai-compatible-embedding.service';

interface OpenAiEmbeddingsResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

const axiosResponse = (
  data: OpenAiEmbeddingsResponse,
): AxiosResponse<OpenAiEmbeddingsResponse> =>
  ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as never,
  }) as AxiosResponse<OpenAiEmbeddingsResponse>;

const CONFIG: EmbeddingsConfig = {
  embeddingBaseUrl: 'https://api.openai.com/v1',
  embeddingApiKey: 'sk-test-key',
  embeddingModel: 'text-embedding-3-small',
};

function buildService() {
  const httpService = {
    post: jest.fn(),
  } as unknown as jest.Mocked<HttpService>;
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(CONFIG),
  } as unknown as ConfigService;

  const service = new OpenAiCompatibleEmbeddingService(
    httpService,
    configService,
  );

  return { service, httpService, configService };
}

describe('OpenAiCompatibleEmbeddingService', () => {
  it('embedBatch() posts to {baseUrl}/embeddings with the input texts, model, and bearer auth header', async () => {
    const { service, httpService } = buildService();
    httpService.post.mockReturnValue(
      of(
        axiosResponse({
          data: [
            { embedding: [0.1, 0.2], index: 0 },
            { embedding: [0.3, 0.4], index: 1 },
          ],
        }),
      ),
    );

    const result = await service.embedBatch(['first', 'second']);

    expect(httpService.post).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      { input: ['first', 'second'], model: 'text-embedding-3-small' },
      { headers: { Authorization: 'Bearer sk-test-key' } },
    );
    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it('embedBatch() sorts the response by index, even when the API returns them out of order', async () => {
    const { service, httpService } = buildService();
    httpService.post.mockReturnValue(
      of(
        axiosResponse({
          data: [
            { embedding: [9, 9], index: 2 },
            { embedding: [1, 1], index: 0 },
            { embedding: [5, 5], index: 1 },
          ],
        }),
      ),
    );

    const result = await service.embedBatch(['a', 'b', 'c']);

    expect(result).toEqual([
      [1, 1],
      [5, 5],
      [9, 9],
    ]);
  });

  it('embed() delegates to embedBatch() with a single-element array and returns the first embedding', async () => {
    const { service, httpService } = buildService();
    httpService.post.mockReturnValue(
      of(axiosResponse({ data: [{ embedding: [0.7, 0.8], index: 0 }] })),
    );

    const result = await service.embed('hello');

    expect(httpService.post).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      { input: ['hello'], model: 'text-embedding-3-small' },
      { headers: { Authorization: 'Bearer sk-test-key' } },
    );
    expect(result).toEqual([0.7, 0.8]);
  });
});
