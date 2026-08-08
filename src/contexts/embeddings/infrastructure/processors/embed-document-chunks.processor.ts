import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import {
  KNOWLEDGE_BASE_EMBEDDING_CONFIG_PORT,
  IKnowledgeBaseEmbeddingConfigPort,
} from '@contexts/embeddings/application/ports/knowledge-base-embedding-config.port';
import { EmbedDocumentChunksService } from '@contexts/embeddings/application/services/write/embed-document-chunks/embed-document-chunks.service';
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
 *
 * The actual "fetch a document's chunks, embed them, save them" work is
 * shared with `ReembedKnowledgeBaseProcessor` via `EmbedDocumentChunksService`
 * — this processor's own job is only to resolve *which* document and
 * *which* model to embed it under before delegating.
 */
@Processor('embeddings')
export class EmbedDocumentChunksProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbedDocumentChunksProcessor.name);

  constructor(
    @Inject(KNOWLEDGE_BASE_EMBEDDING_CONFIG_PORT)
    private readonly knowledgeBaseEmbeddingConfig: IKnowledgeBaseEmbeddingConfigPort,
    private readonly modelRegistry: EmbeddingModelRegistryService,
    private readonly embedDocumentChunks: EmbedDocumentChunksService,
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

      const embeddedCount = await this.embedDocumentChunks.execute(
        documentId,
        knowledgeBaseId,
        config.embeddingModel,
        dimensions,
      );

      if (embeddedCount === 0) {
        this.logger.warn(`No chunks found for document: ${documentId}`);
        return;
      }

      this.logger.log(
        `Embedded document: ${documentId} (${embeddedCount} chunks)`,
      );
    });
  }
}
