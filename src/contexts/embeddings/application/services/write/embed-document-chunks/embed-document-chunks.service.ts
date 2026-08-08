import { Inject, Injectable } from '@nestjs/common';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import {
  CHUNK_SOURCE_PORT,
  IChunkSourcePort,
} from '@contexts/embeddings/application/ports/chunk-source.port';
import {
  EMBEDDING_PORT,
  IEmbeddingPort,
} from '@contexts/embeddings/application/ports/embedding.port';
import { EmbeddingBuilder } from '@contexts/embeddings/domain/builders/embedding.builder';
import {
  EMBEDDING_WRITE_REPOSITORY,
  IEmbeddingWriteRepository,
} from '@contexts/embeddings/domain/repositories/write/embedding-write.repository';

/**
 * Shared by both `EmbedDocumentChunksProcessor` (one document, triggered by
 * `documents`' chunking pipeline) and `ReembedKnowledgeBaseProcessor` (every
 * document in a Knowledge Base, triggered by a model change) — embedding a
 * single document's chunks under a given model is identical work in both
 * flows; only the orchestration around it (which document(s), what happens
 * before/after) differs per caller.
 */
@Injectable()
export class EmbedDocumentChunksService {
  constructor(
    @Inject(CHUNK_SOURCE_PORT)
    private readonly chunkSource: IChunkSourcePort,
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: IEmbeddingPort,
    @Inject(EMBEDDING_WRITE_REPOSITORY)
    private readonly embeddingWriteRepository: IEmbeddingWriteRepository,
    private readonly embeddingBuilder: EmbeddingBuilder,
  ) {}

  /**
   * Returns the number of chunks embedded (0 if the document has none).
   */
  async execute(
    documentId: string,
    knowledgeBaseId: string,
    model: string,
    dimensions: number,
  ): Promise<number> {
    const chunks = await this.chunkSource.findByDocumentId(documentId);
    if (chunks.length === 0) return 0;

    const vectors = await this.embeddingPort.embedBatch(
      chunks.map((chunk) => chunk.text),
      model,
    );

    const now = new Date();
    const embeddings = chunks.map((chunk, i) =>
      this.embeddingBuilder
        .withId(UuidValueObject.generate().value)
        .withKnowledgeBaseId(knowledgeBaseId)
        .withDocumentId(documentId)
        .withChunkId(chunk.id)
        .withChunkText(chunk.text)
        .withChunkPosition(chunk.position)
        .withEmbedding(vectors[i])
        .withDimensions(dimensions)
        .withModel(model)
        .withCreatedAt(now)
        .withUpdatedAt(now)
        .build(),
    );

    await this.embeddingWriteRepository.saveMany(embeddings, dimensions);

    return embeddings.length;
  }
}
