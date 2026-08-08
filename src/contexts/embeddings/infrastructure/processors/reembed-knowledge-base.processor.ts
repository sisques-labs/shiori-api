import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import {
  CHUNK_SOURCE_PORT,
  IChunkSourcePort,
} from '@contexts/embeddings/application/ports/chunk-source.port';
import {
  KNOWLEDGE_BASE_REEMBEDDING_STATUS_PORT,
  IKnowledgeBaseReembeddingStatusPort,
} from '@contexts/embeddings/application/ports/knowledge-base-reembedding-status.port';
import { EmbedDocumentChunksService } from '@contexts/embeddings/application/services/write/embed-document-chunks/embed-document-chunks.service';
import {
  EMBEDDING_WRITE_REPOSITORY,
  IEmbeddingWriteRepository,
} from '@contexts/embeddings/domain/repositories/write/embedding-write.repository';
import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';
import { ReembedKnowledgeBaseJobData } from '@contexts/embeddings/infrastructure/services/bullmq-embedding-reembed-queue.service';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

/**
 * Runs the actual re-embed work for a `ChangeKnowledgeBaseEmbeddingModel`
 * request. NOT itself a BullMQ `@Processor` — routed to by
 * `EmbedDocumentChunksProcessor`'s single `@Processor('embeddings')` Worker
 * based on `job.name` (see that file's doc comment): running two
 * independent Worker instances against the same BullMQ queue name would
 * mean either one could pick up either job type, since BullMQ has no
 * built-in per-job-type routing across multiple Workers on one queue — a
 * single Worker with explicit job-name dispatch avoids that race entirely
 * while still living in "the same existing `embeddings` queue, a new job
 * type" per design.md.
 *
 * Per-document embedding itself is not duplicated here — it delegates to
 * `EmbedDocumentChunksService`, the same shared step
 * `EmbedDocumentChunksProcessor` uses for a single document. This
 * processor's own responsibility is the orchestration around it that's
 * unique to a model change: enumerate every document in the Knowledge
 * Base, embed each one under the new model, then clean up the previous
 * model's rows and report status back to `knowledge-bases`.
 */
@Injectable()
export class ReembedKnowledgeBaseProcessor {
  private readonly logger = new Logger(ReembedKnowledgeBaseProcessor.name);

  constructor(
    @Inject(CHUNK_SOURCE_PORT)
    private readonly chunkSource: IChunkSourcePort,
    @Inject(EMBEDDING_WRITE_REPOSITORY)
    private readonly embeddingWriteRepository: IEmbeddingWriteRepository,
    @Inject(KNOWLEDGE_BASE_REEMBEDDING_STATUS_PORT)
    private readonly reembeddingStatus: IKnowledgeBaseReembeddingStatusPort,
    private readonly modelRegistry: EmbeddingModelRegistryService,
    private readonly embedDocumentChunks: EmbedDocumentChunksService,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
  ) {}

  async process(job: Job<ReembedKnowledgeBaseJobData>): Promise<void> {
    const { knowledgeBaseId, previousModel, newModel } = job.data;

    await this.knowledgeBaseContext.run(knowledgeBaseId, async () => {
      try {
        const { dimensions: newDimensions } =
          this.modelRegistry.getOrThrow(newModel);

        // Clears any partial rows from a previously failed attempt at this
        // same target model — makes every attempt a clean rewrite,
        // regardless of how a prior one failed.
        await this.embeddingWriteRepository.deleteByKnowledgeBaseIdAndModel(
          knowledgeBaseId,
          newModel,
        );

        const documentIds =
          await this.chunkSource.findKnowledgeBaseDocumentIds(knowledgeBaseId);

        // Reported after every document (not just at the end) so a caller
        // polling `job.progress` can show "processed X of Y documents"
        // while a re-embed of a large Knowledge Base is still running.
        await job.updateProgress({
          processedDocuments: 0,
          totalDocuments: documentIds.length,
        });

        for (const [index, documentId] of documentIds.entries()) {
          await this.embedDocumentChunks.execute(
            documentId,
            knowledgeBaseId,
            newModel,
            newDimensions,
          );

          await job.updateProgress({
            processedDocuments: index + 1,
            totalDocuments: documentIds.length,
          });
        }

        // Only removed after every document has succeeded — avoids a
        // partial state where some documents are searchable under the new
        // model while others have zero embeddings if the job fails partway.
        await this.embeddingWriteRepository.deleteByKnowledgeBaseIdAndModel(
          knowledgeBaseId,
          previousModel,
        );

        await this.reembeddingStatus.complete(knowledgeBaseId);

        this.logger.log(
          `Re-embedded knowledge base: ${knowledgeBaseId} (${previousModel} -> ${newModel}, ${documentIds.length} documents)`,
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);

        this.logger.error(
          `Re-embed failed for knowledge base ${knowledgeBaseId}: ${reason}`,
        );

        await this.reembeddingStatus.fail(knowledgeBaseId, reason);

        throw error;
      }
    });
  }
}
