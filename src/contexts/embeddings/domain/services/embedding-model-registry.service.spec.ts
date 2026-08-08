import { EMBEDDING_MODELS_REGISTRY } from '@contexts/embeddings/domain/constants/embedding-models-registry.constant';
import { UnknownEmbeddingModelException } from '@contexts/embeddings/domain/exceptions/unknown-embedding-model.exception';

import { EmbeddingModelRegistryService } from './embedding-model-registry.service';

describe('EmbeddingModelRegistryService', () => {
  let service: EmbeddingModelRegistryService;

  beforeEach(() => {
    service = new EmbeddingModelRegistryService();
  });

  describe('findById()', () => {
    it('returns the model definition for a known id', () => {
      const model = service.findById('text-embedding-3-small');
      expect(model).toEqual({
        id: 'text-embedding-3-small',
        provider: 'openai',
        dimensions: 1536,
      });
    });

    it('returns null for an unknown id', () => {
      expect(service.findById('not-a-real-model')).toBeNull();
    });
  });

  describe('getOrThrow()', () => {
    it('returns the model definition for a known id', () => {
      expect(service.getOrThrow('nomic-embed-text')).toEqual({
        id: 'nomic-embed-text',
        provider: 'ollama',
        dimensions: 768,
      });
    });

    it('throws UnknownEmbeddingModelException for an unknown id', () => {
      expect(() => service.getOrThrow('not-a-real-model')).toThrow(
        UnknownEmbeddingModelException,
      );
    });
  });

  describe('listAll()', () => {
    it('returns the full static registry', () => {
      expect(service.listAll()).toBe(EMBEDDING_MODELS_REGISTRY);
      expect(service.listAll().length).toBeGreaterThan(0);
    });
  });
});
