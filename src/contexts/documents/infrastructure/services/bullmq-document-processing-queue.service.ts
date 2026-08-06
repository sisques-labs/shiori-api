import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { IDocumentProcessingQueuePort } from '@contexts/documents/application/ports/document-processing-queue.port';

export const CHUNK_DOCUMENT_JOB_NAME = 'chunk-document';

@Injectable()
export class BullmqDocumentProcessingQueueService implements IDocumentProcessingQueuePort {
  constructor(@InjectQueue('documents') private readonly queue: Queue) {}

  async enqueueChunking(
    documentId: string,
    knowledgeBaseId: string,
  ): Promise<void> {
    await this.queue.add(CHUNK_DOCUMENT_JOB_NAME, {
      documentId,
      knowledgeBaseId,
    });
  }
}
