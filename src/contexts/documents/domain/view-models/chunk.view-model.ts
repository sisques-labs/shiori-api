import { BaseViewModel } from '@sisques-labs/nestjs-kit';

import { IChunkPrimitives } from '@contexts/documents/domain/primitives/chunk.primitives';

export class ChunkViewModel extends BaseViewModel {
  public readonly documentId: string;
  public readonly knowledgeBaseId: string;
  public readonly position: number;
  public readonly text: string;

  constructor(props: IChunkPrimitives) {
    super(props.id, props.createdAt, props.updatedAt);
    this.documentId = props.documentId;
    this.knowledgeBaseId = props.knowledgeBaseId;
    this.position = props.position;
    this.text = props.text;
  }
}
