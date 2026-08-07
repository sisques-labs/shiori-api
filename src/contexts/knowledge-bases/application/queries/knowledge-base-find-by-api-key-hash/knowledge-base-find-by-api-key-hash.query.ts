export interface KnowledgeBaseFindByApiKeyHashQueryInput {
  hash: string;
}

/** Internal-only — dispatched exclusively by `KnowledgeBaseApiKeyGuard`. No transport surface. */
export class KnowledgeBaseFindByApiKeyHashQuery {
  public readonly hash: string;

  constructor(input: KnowledgeBaseFindByApiKeyHashQueryInput) {
    this.hash = input.hash;
  }
}
