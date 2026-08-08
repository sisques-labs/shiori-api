import { StringValueObject } from '@sisques-labs/nestjs-kit';

/**
 * Free-form model id — validated against `embeddings`' registry at the
 * application layer via `IEmbeddingModelValidationPort`, not by this value
 * object itself. `knowledge-bases` has no cross-context knowledge of which
 * ids are valid; it only knows "a non-empty string up to 100 chars", the
 * same shape constraint `embeddings`' own `EmbeddingModelValueObject` uses.
 */
export class KnowledgeBaseEmbeddingModelValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { allowEmpty: false, maxLength: 100 });
  }
}
