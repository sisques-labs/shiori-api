import { EMBEDDING_MODELS_REGISTRY } from '@contexts/embeddings/domain/constants/embedding-models-registry.constant';
import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';

import { EmbeddingAvailableModelsQueryHandler } from './embedding-available-models.handler';

describe('EmbeddingAvailableModelsQueryHandler', () => {
  it('returns the full static registry', async () => {
    const handler = new EmbeddingAvailableModelsQueryHandler(
      new EmbeddingModelRegistryService(),
    );

    const result = await handler.execute();

    expect(result).toBe(EMBEDDING_MODELS_REGISTRY);
  });
});
