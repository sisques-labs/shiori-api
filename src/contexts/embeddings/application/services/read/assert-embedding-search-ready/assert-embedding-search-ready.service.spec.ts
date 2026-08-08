import { EmbeddingSearchNotReadyException } from '@contexts/embeddings/domain/exceptions/embedding-search-not-ready.exception';

import { AssertEmbeddingSearchReadyService } from './assert-embedding-search-ready.service';

describe('AssertEmbeddingSearchReadyService', () => {
  const service = new AssertEmbeddingSearchReadyService();

  it('does nothing when READY', () => {
    expect(() => service.execute('kb-1', 'READY')).not.toThrow();
  });

  it('throws EmbeddingSearchNotReadyException when REEMBEDDING', () => {
    expect(() => service.execute('kb-1', 'REEMBEDDING')).toThrow(
      EmbeddingSearchNotReadyException,
    );
  });

  it('throws EmbeddingSearchNotReadyException when FAILED', () => {
    expect(() => service.execute('kb-1', 'FAILED')).toThrow(
      EmbeddingSearchNotReadyException,
    );
  });
});
