import { Criteria } from '@sisques-labs/nestjs-kit';

export interface DocumentFindByCriteriaQueryInput {
  criteria: Criteria;
}

export class DocumentFindByCriteriaQuery {
  public readonly criteria: Criteria;

  constructor(input: DocumentFindByCriteriaQueryInput) {
    this.criteria = input.criteria;
  }
}
