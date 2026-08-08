import { Inject, Injectable } from '@nestjs/common';
import { IBaseService } from '@sisques-labs/nestjs-kit';

import {
  EMBEDDING_MODEL_VALIDATION_PORT,
  IEmbeddingModelValidationPort,
} from '@contexts/knowledge-bases/application/ports/embedding-model-validation.port';
import { InvalidKnowledgeBaseEmbeddingModelException } from '@contexts/knowledge-bases/domain/exceptions/invalid-knowledge-base-embedding-model.exception';

@Injectable()
export class AssertEmbeddingModelIsValidService implements IBaseService<
  string,
  void
> {
  constructor(
    @Inject(EMBEDDING_MODEL_VALIDATION_PORT)
    private readonly embeddingModelValidation: IEmbeddingModelValidationPort,
  ) {}

  async execute(embeddingModel: string): Promise<void> {
    const isValid = await this.embeddingModelValidation.isValid(embeddingModel);
    if (!isValid)
      throw new InvalidKnowledgeBaseEmbeddingModelException(embeddingModel);
  }
}
