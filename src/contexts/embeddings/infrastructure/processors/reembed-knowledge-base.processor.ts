import { Inject, Injectable, Logger } from '@nestjs/common';
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
  KNOWLEDGE_BASE_REEMBEDDING_STATUS_PORT,
  IKnowledgeBaseReembeddingStatusPort,
} from '@contexts/embeddings/application/ports/knowledge-base-reembedding-status.port';
import { EmbeddingBuilder } from '@contexts/embeddings/domain/builders/embedding.builder';
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
 */
@Injectable()
export class ReembedKnowledgeBaseProcessor {
  private readonly logger = new Logger(ReembedKnowledgeBaseProcessor.name);

  constructor(
    @Inject(CHUNK_SOURCE_PORT)
    private readonly chunkSource: IChunkSourcePort,
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: IEmbeddingPort,
    @Inject(EMBEDDING_WRITE_REPOSITORY)
    private readonly embeddingWriteRepository: IEmbeddingWriteRepository,
    @Inject(KNOWLEDGE_BASE_REEMBEDDING_STATUS_PORT)
    private readonly reembeddingStatus: IKnowledgeBaseReembeddingStatusPort,
    private readonly modelRegistry: EmbeddingModelRegistryService,
    private readonly embeddingBuilder: EmbeddingBuilder,
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

        for (const documentId of documentIds) {
          const chunks = await this.chunkSource.findByDocumentId(documentId);
          if (chunks.length === 0) continue;

          const vectors = await this.embeddingPort.embedBatch(
            chunks.map((chunk) => chunk.text),
            newModel,
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
              .withDimensions(newDimensions)
              .withModel(newModel)
              .withCreatedAt(now)
              .withUpdatedAt(now)
              .build(),
          );

          await this.embeddingWriteRepository.saveMany(
            embeddings,
            newDimensions,
          );
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
