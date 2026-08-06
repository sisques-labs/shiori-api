import { IChunkPrimitives } from '@contexts/documents/domain/primitives/chunk.primitives';

export class ChunkViewModel {
  public readonly id: string;
  public readonly documentId: string;
  public readonly knowledgeBaseId: string;
  public readonly position: number;
  public readonly text: string;
  public readonly createdAt: Date;

  constructor(props: IChunkPrimitives) {
    this.id = props.id;
    this.documentId = props.documentId;
    this.knowledgeBaseId = props.knowledgeBaseId;
    this.position = props.position;
    this.text = props.text;
    this.createdAt = props.createdAt;
  }
}
