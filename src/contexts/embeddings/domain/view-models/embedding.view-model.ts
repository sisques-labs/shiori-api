import { IEmbeddingPrimitives } from '@contexts/embeddings/domain/primitives/embedding.primitives';

export class EmbeddingViewModel {
  public readonly id: string;
  public readonly knowledgeBaseId: string;
  public readonly documentId: string;
  public readonly chunkId: string;
  public readonly chunkText: string;
  public readonly chunkPosition: number;
  public readonly embedding: number[];
  public readonly model: string;
  public readonly createdAt: Date;

  constructor(props: IEmbeddingPrimitives) {
    this.id = props.id;
    this.knowledgeBaseId = props.knowledgeBaseId;
    this.documentId = props.documentId;
    this.chunkId = props.chunkId;
    this.chunkText = props.chunkText;
    this.chunkPosition = props.chunkPosition;
    this.embedding = props.embedding;
    this.model = props.model;
    this.createdAt = props.createdAt;
  }
}
