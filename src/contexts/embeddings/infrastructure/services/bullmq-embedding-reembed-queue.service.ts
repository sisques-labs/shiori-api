import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { IEmbeddingReembedQueuePort } from '@contexts/embeddings/application/ports/embedding-reembed-queue.port';

export const REEMBED_KNOWLEDGE_BASE_JOB_NAME = 'reembed-knowledge-base';

export interface ReembedKnowledgeBaseJobData {
  knowledgeBaseId: string;
  previousModel: string;
  newModel: string;
}

@Injectable()
export class BullmqEmbeddingReembedQueueService implements IEmbeddingReembedQueuePort {
  constructor(@InjectQueue('embeddings') private readonly queue: Queue) {}

  async enqueueReembed(
    knowledgeBaseId: string,
    previousModel: string,
    newModel: string,
  ): Promise<void> {
    await this.queue.add(REEMBED_KNOWLEDGE_BASE_JOB_NAME, {
      knowledgeBaseId,
      previousModel,
      newModel,
    } satisfies ReembedKnowledgeBaseJobData);
  }
}
