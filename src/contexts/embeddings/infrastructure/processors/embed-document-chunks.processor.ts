import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';
import { Job } from 'bullmq';

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
import { EmbeddingsConfig } from '@contexts/embeddings/infrastructure/config/embeddings.config';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

export interface EmbedDocumentChunksJobData {
  documentId: string;
  knowledgeBaseId: string;
}

@Processor('embeddings')
export class EmbedDocumentChunksProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbedDocumentChunksProcessor.name);
  private readonly embeddingModel: string;

  constructor(
    @Inject(CHUNK_SOURCE_PORT)
    private readonly chunkSource: IChunkSourcePort,
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: IEmbeddingPort,
    @Inject(EMBEDDING_WRITE_REPOSITORY)
    private readonly embeddingWriteRepository: IEmbeddingWriteRepository,
    private readonly embeddingBuilder: EmbeddingBuilder,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
    configService: ConfigService,
  ) {
    super();
    this.embeddingModel =
      configService.getOrThrow<EmbeddingsConfig>('embeddings').embeddingModel;
  }

  async process(job: Job<EmbedDocumentChunksJobData>): Promise<void> {
    const { documentId, knowledgeBaseId } = job.data;

    // No HTTP request drives this path, so KnowledgeBaseContextInterceptor
    // never runs — the tenant frame has to be opened here explicitly.
    await this.knowledgeBaseContext.run(knowledgeBaseId, async () => {
      const chunks = await this.chunkSource.findByDocumentId(documentId);
      if (chunks.length === 0) {
        this.logger.warn(`No chunks found for document: ${documentId}`);
        return;
      }

      const vectors = await this.embeddingPort.embedBatch(
        chunks.map((chunk) => chunk.text),
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
          .withModel(this.embeddingModel)
          .withCreatedAt(now)
          .withUpdatedAt(now)
          .build(),
      );

      await this.embeddingWriteRepository.saveMany(embeddings);

      this.logger.log(
        `Embedded document: ${documentId} (${embeddings.length} chunks)`,
      );
    });
  }
}
