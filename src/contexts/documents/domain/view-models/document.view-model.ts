import { BaseViewModel } from '@sisques-labs/nestjs-kit';

import { IDocumentPrimitives } from '@contexts/documents/domain/primitives/document.primitives';

export class DocumentViewModel extends BaseViewModel {
  public readonly knowledgeBaseId: string;
  public readonly title: string;
  public readonly content: string;
  public readonly status: string;
  public readonly failureReason: string | null;
  public readonly chunkCount: number;

  constructor(props: IDocumentPrimitives) {
    super(props.id, props.createdAt, props.updatedAt);
    this.knowledgeBaseId = props.knowledgeBaseId;
    this.title = props.title;
    this.content = props.content;
    this.status = props.status;
    this.failureReason = props.failureReason;
    this.chunkCount = props.chunkCount;
  }
}
