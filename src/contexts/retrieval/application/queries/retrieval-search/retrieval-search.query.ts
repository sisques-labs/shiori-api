export interface RetrievalSearchQueryInput {
  query: string;
  topK?: number;
}

export class RetrievalSearchQuery {
  public readonly query: string;
  public readonly topK?: number;

  constructor(input: RetrievalSearchQueryInput) {
    this.query = input.query;
    this.topK = input.topK;
  }
}
