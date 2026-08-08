import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';

import { EmbeddingModelExistsQuery } from './embedding-model-exists.query';
import { EmbeddingModelExistsQueryHandler } from './embedding-model-exists.handler';

describe('EmbeddingModelExistsQueryHandler', () => {
  const handler = new EmbeddingModelExistsQueryHandler(
    new EmbeddingModelRegistryService(),
  );

  it('returns true for a known model', async () => {
    const result = await handler.execute(
      new EmbeddingModelExistsQuery({ modelId: 'text-embedding-3-small' }),
    );
    expect(result).toBe(true);
  });

  it('returns false for an unknown model', async () => {
    const result = await handler.execute(
      new EmbeddingModelExistsQuery({ modelId: 'not-a-real-model' }),
    );
    expect(result).toBe(false);
  });
});
