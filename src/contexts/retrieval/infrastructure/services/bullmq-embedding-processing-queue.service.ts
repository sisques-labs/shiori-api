import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { IEmbeddingProcessingQueuePort } from '@contexts/retrieval/application/ports/embedding-processing-queue.port';

export const EMBED_DOCUMENT_CHUNKS_JOB_NAME = 'embed-document-chunks';

@Injectable()
export class BullmqEmbeddingProcessingQueueService implements IEmbeddingProcessingQueuePort {
  constructor(@InjectQueue('retrieval') private readonly queue: Queue) {}

  async enqueueEmbedding(
    documentId: string,
    knowledgeBaseId: string,
  ): Promise<void> {
    await this.queue.add(EMBED_DOCUMENT_CHUNKS_JOB_NAME, {
      documentId,
      knowledgeBaseId,
    });
  }
}
