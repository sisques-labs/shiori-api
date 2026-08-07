import { BaseViewModel } from '@sisques-labs/nestjs-kit';

import { IKnowledgeBasePrimitives } from '@contexts/knowledge-bases/domain/primitives/knowledge-base.primitives';

/**
 * `apiKeyHash` is present here because `KnowledgeBaseApiKeyGuard` resolves
 * tenants through the read repository — transport mappers MUST strip it
 * before serializing any response.
 */
export class KnowledgeBaseViewModel extends BaseViewModel {
  public readonly name: string;
  public readonly description: string | null;
  public readonly apiKeyHash: string;

  constructor(props: IKnowledgeBasePrimitives) {
    super(props.id, props.createdAt, props.updatedAt);
    this.name = props.name;
    this.description = props.description;
    this.apiKeyHash = props.apiKeyHash;
  }
}
