import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';

export type KnowledgeBaseFindByIdQueryInput = Pick<
  IKnowledgeBasePrimitives,
  'id'
>;

export class KnowledgeBaseFindByIdQuery {
  public readonly id: string;

  constructor(input: KnowledgeBaseFindByIdQueryInput) {
    this.id = input.id;
  }
}
