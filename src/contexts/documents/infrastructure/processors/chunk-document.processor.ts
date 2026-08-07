import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { AggregateRoot, EventBus } from '@nestjs/cqrs';
import { Job } from 'bullmq';

import { ChunkBuilder } from '@contexts/documents/domain/builders/chunk.builder';
import {
  DOCUMENT_WRITE_REPOSITORY,
  IDocumentWriteRepository,
} from '@contexts/documents/domain/repositories/write/document-write.repository';
import {
  CHUNK_WRITE_REPOSITORY,
  IChunkWriteRepository,
} from '@contexts/documents/domain/repositories/write/chunk-write.repository';
import {
  CHUNKING_STRATEGY_PORT,
  IChunkingStrategyPort,
} from '@contexts/documents/application/ports/chunking-strategy.port';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';

export interface ChunkDocumentJobData {
  documentId: string;
  knowledgeBaseId: string;
}

@Processor('documents')
export class ChunkDocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(ChunkDocumentProcessor.name);

  constructor(
    @Inject(DOCUMENT_WRITE_REPOSITORY)
    private readonly documentWriteRepository: IDocumentWriteRepository,
    @Inject(CHUNK_WRITE_REPOSITORY)
    private readonly chunkWriteRepository: IChunkWriteRepository,
    @Inject(CHUNKING_STRATEGY_PORT)
    private readonly chunkingStrategy: IChunkingStrategyPort,
    private readonly chunkBuilder: ChunkBuilder,
    private readonly knowledgeBaseContext: KnowledgeBaseContext,
    private readonly eventBus: EventBus,
  ) {
    super();
  }

  async process(job: Job<ChunkDocumentJobData>): Promise<void> {
    const { documentId, knowledgeBaseId } = job.data;

    // No HTTP request drives this path, so KnowledgeBaseContextInterceptor
    // never runs — the tenant frame has to be opened here explicitly.
    await this.knowledgeBaseContext.run(knowledgeBaseId, async () => {
      const document = await this.documentWriteRepository.findById(documentId);
      if (!document) {
        this.logger.warn(`Document not found, skipping job: ${documentId}`);
        return;
      }

      document.startChunking();
      await this.documentWriteRepository.save(document);
      await this.publishEvents(document);
      await job.updateProgress(25);

      try {
        const chunks = this.chunkingStrategy.chunk(document.content.value);
        await job.updateProgress(50);

        const chunkAggregates = chunks.map((chunk) =>
          this.chunkBuilder
            .withId(UuidValueObject.generate().value)
            .withDocumentId(document.id.value)
            .withKnowledgeBaseId(document.knowledgeBaseId.value)
            .withPosition(chunk.position)
            .withText(chunk.text)
            .withCreatedAt(new Date())
            .build(),
        );

        await this.chunkWriteRepository.saveMany(chunkAggregates);
        await job.updateProgress(75);

        document.completeChunking(chunkAggregates.length);
        await this.documentWriteRepository.save(document);
        await this.publishEvents(document);
        await job.updateProgress(100);

        this.logger.log(
          `Document chunked: ${documentId} (${chunkAggregates.length} chunks)`,
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        document.failChunking(reason);
        await this.documentWriteRepository.save(document);
        await this.publishEvents(document);

        this.logger.error(
          `Chunking failed for document ${documentId}: ${reason}`,
        );
        throw error;
      }
    });
  }

  private async publishEvents(aggregate: AggregateRoot): Promise<void> {
    await this.eventBus.publishAll(aggregate.getUncommittedEvents());
    await aggregate.commit();
  }
}
