import { IEmbeddingModelValidationPort } from '@contexts/knowledge-bases/application/ports/embedding-model-validation.port';
import { InvalidKnowledgeBaseEmbeddingModelException } from '@contexts/knowledge-bases/domain/exceptions/invalid-knowledge-base-embedding-model.exception';

import { AssertEmbeddingModelIsValidService } from './assert-embedding-model-is-valid.service';

describe('AssertEmbeddingModelIsValidService', () => {
  let embeddingModelValidation: jest.Mocked<IEmbeddingModelValidationPort>;
  let service: AssertEmbeddingModelIsValidService;

  beforeEach(() => {
    embeddingModelValidation = { isValid: jest.fn() };
    service = new AssertEmbeddingModelIsValidService(embeddingModelValidation);
  });

  it('resolves when the model is valid', async () => {
    embeddingModelValidation.isValid.mockResolvedValue(true);

    await expect(
      service.execute('text-embedding-3-small'),
    ).resolves.toBeUndefined();
  });

  it('throws InvalidKnowledgeBaseEmbeddingModelException when the model is unknown', async () => {
    embeddingModelValidation.isValid.mockResolvedValue(false);

    await expect(service.execute('not-a-real-model')).rejects.toThrow(
      InvalidKnowledgeBaseEmbeddingModelException,
    );
  });
});
