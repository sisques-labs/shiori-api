export interface DocumentFindBatchQueryInput {
  page: number;
  perPage: number;
}

/**
 * Internal only — no transport surface. Dispatched exclusively by
 * `DocumentBatchFinderAdapter` via the global QueryBus, mirroring the
 * port + adapter + CQRS pattern used by `HashApiKeyAdapter` in
 * `knowledge-bases`.
 */
export class DocumentFindBatchQuery {
  public readonly page: number;
  public readonly perPage: number;

  constructor(input: DocumentFindBatchQueryInput) {
    this.page = input.page;
    this.perPage = input.perPage;
  }
}
