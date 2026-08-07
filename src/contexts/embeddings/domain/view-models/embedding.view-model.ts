import { BaseViewModel } from '@sisques-labs/nestjs-kit';

import { IEmbeddingPrimitives } from '@contexts/embeddings/domain/primitives/embedding.primitives';

export class EmbeddingViewModel extends BaseViewModel {
  public readonly knowledgeBaseId: string;
  public readonly documentId: string;
  public readonly chunkId: string;
  public readonly chunkText: string;
  public readonly chunkPosition: number;
  public readonly embedding: number[];
  public readonly model: string;

  constructor(props: IEmbeddingPrimitives) {
    super(props.id, props.createdAt, props.updatedAt);
    this.knowledgeBaseId = props.knowledgeBaseId;
    this.documentId = props.documentId;
    this.chunkId = props.chunkId;
    this.chunkText = props.chunkText;
    this.chunkPosition = props.chunkPosition;
    this.embedding = props.embedding;
    this.model = props.model;
  }
}
