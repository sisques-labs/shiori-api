import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
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
import {
  KNOWLEDGE_BASE_EMBEDDING_CONFIG_PORT,
  IKnowledgeBaseEmbeddingConfigPort,
} from '@contexts/embeddings/application/ports/knowledge-base-embedding-config.port';
import { EmbeddingBuilder } from '@contexts/embeddings/domain/builders/embedding.builder';
import {
  EMBEDDING_WRITE_REPOSITORY,
  IEmbeddingWriteRepository,
} from '@contexts/embeddings/domain/repositories/write/embedding-write.repository';
import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';
import { ReembedKnowledgeBaseProcessor } from '@contexts/embeddings/infrastructure/processors/reembed-knowledge-base.processor';
import { REEMBED_KNOWLEDGE_BASE_JOB_NAME } from '@contexts/embeddings/infrastructure/services/bullmq-embedding-reembed-queue.service';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

export interface EmbedDocumentChunksJobData {
  documentId: string;
  knowledgeBaseId: string;
}

/**
 * The single BullMQ `Worker` registered for the `embeddings` queue.
 * `ReembedKnowledgeBaseProcessor`'s job type shares this same queue (see
 * design.md — "existing queue, new job type"), so it is routed to here by
 * `job.name` rather than registered as its own `@Processor('embeddings')`:
 * two independent Worker instances on the same queue name would each be
 * eligible to pick up either job type (BullMQ has no per-Worker job-type
 * filtering across multiple Workers sharing one queue), which could hand a
 * re-embed job's payload to code that only knows how to read an
 * `EmbedDocumentChunksJobData` shape, or vice versa.
 */
@Processor('embeddings')
export class EmbedDocumentChunksProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbedDocumentChunksProcessor.name);

  constructor(
    @Inject(CHUNK_SOURCE_PORT)
    private readonly chunkSource: IChunkSourcePort,
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: IEmbeddingPort,
    @Inject(EMBEDDING_WRITE_REPOSITORY)
    private readonly embeddingWriteRepository: IEmbeddingWriteRepository,
    @Inject(KNOWLEDGE_BASE_EMBEDDING_CONFIG_PORT)
    private readonly knowledgeBaseEmbeddingConfig: IKnowledgeBaseEmbeddingConfigPort,
    private readonly modelRegistry: EmbeddingModelRegistryService,
    private readonly embeddingBuilder: EmbeddingBuilder,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
    private readonly reembedProcessor: ReembedKnowledgeBaseProcessor,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === REEMBED_KNOWLEDGE_BASE_JOB_NAME) {
      await this.reembedProcessor.process(job);
      return;
    }

    await this.processEmbedDocumentChunks(
      job as Job<EmbedDocumentChunksJobData>,
    );
  }

  private async processEmbedDocumentChunks(
    job: Job<EmbedDocumentChunksJobData>,
  ): Promise<void> {
    const { documentId, knowledgeBaseId } = job.data;

    // No HTTP request drives this path, so KnowledgeBaseContextInterceptor
    // never runs — the tenant frame has to be opened here explicitly.
    await this.knowledgeBaseContext.run(knowledgeBaseId, async () => {
      const chunks = await this.chunkSource.findByDocumentId(documentId);
      if (chunks.length === 0) {
        this.logger.warn(`No chunks found for document: ${documentId}`);
        return;
      }

      // This step runs regardless of the Knowledge Base's embeddingStatus —
      // a document's own chunk→embed flow is independent of another,
      // possibly-concurrent, model-change re-embed for the same tenant.
      const config =
        await this.knowledgeBaseEmbeddingConfig.getByKnowledgeBaseId(
          knowledgeBaseId,
        );
      const { dimensions } = this.modelRegistry.getOrThrow(
        config.embeddingModel,
      );

      const vectors = await this.embeddingPort.embedBatch(
        chunks.map((chunk) => chunk.text),
        config.embeddingModel,
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
          .withModel(config.embeddingModel)
          .withCreatedAt(now)
          .withUpdatedAt(now)
          .build(),
      );

      await this.embeddingWriteRepository.saveMany(embeddings, dimensions);

      this.logger.log(
        `Embedded document: ${documentId} (${embeddings.length} chunks)`,
      );
    });
  }
}
