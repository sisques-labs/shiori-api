import { UuidValueObject } from '@sisques-labs/nestjs-kit';
import { Job } from 'bullmq';

import { IKnowledgeBaseEmbeddingConfigPort } from '@contexts/embeddings/application/ports/knowledge-base-embedding-config.port';
import { EmbedDocumentChunksService } from '@contexts/embeddings/application/services/write/embed-document-chunks/embed-document-chunks.service';
import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

import {
  EmbedDocumentChunksJobData,
  EmbedDocumentChunksProcessor,
} from './embed-document-chunks.processor';
import { ReembedKnowledgeBaseProcessor } from './reembed-knowledge-base.processor';

function buildProcessor() {
  const knowledgeBaseEmbeddingConfig: jest.Mocked<IKnowledgeBaseEmbeddingConfigPort> =
    {
      getByKnowledgeBaseId: jest.fn().mockResolvedValue({
        embeddingModel: 'text-embedding-3-small',
        embeddingStatus: 'READY',
      }),
    };
  const embedDocumentChunks = {
    execute: jest.fn().mockResolvedValue(2),
  } as unknown as jest.Mocked<EmbedDocumentChunksService>;
  const knowledgeBaseContext = {
    run: jest.fn((_id: string, fn: () => unknown) => fn()),
  } as unknown as jest.Mocked<KnowledgeBaseContext>;
  const reembedProcessor = {
    process: jest.fn(),
  } as unknown as jest.Mocked<ReembedKnowledgeBaseProcessor>;

  const processor = new EmbedDocumentChunksProcessor(
    knowledgeBaseEmbeddingConfig,
    new EmbeddingModelRegistryService(),
    embedDocumentChunks,
    knowledgeBaseContext,
    reembedProcessor,
  );

  return {
    processor,
    knowledgeBaseEmbeddingConfig,
    embedDocumentChunks,
    knowledgeBaseContext,
    reembedProcessor,
  };
}

function buildJob(data: EmbedDocumentChunksJobData): Job {
  return { name: 'embed-document-chunks', data } as Job;
}

describe('EmbedDocumentChunksProcessor', () => {
  const documentId = UuidValueObject.generate().value;
  const knowledgeBaseId = UuidValueObject.generate().value;

  it('opens the tenancy frame with the job knowledgeBaseId and delegates to EmbedDocumentChunksService with the resolved model/dimensions', async () => {
    const { processor, embedDocumentChunks, knowledgeBaseContext } =
      buildProcessor();

    await processor.process(buildJob({ documentId, knowledgeBaseId }));

    expect(knowledgeBaseContext.run).toHaveBeenCalledWith(
      knowledgeBaseId,
      expect.any(Function),
    );
    expect(embedDocumentChunks.execute).toHaveBeenCalledWith(
      documentId,
      knowledgeBaseId,
      'text-embedding-3-small',
      1536,
    );
  });

  it('logs a warning and does not throw when the document has no chunks', async () => {
    const { processor, embedDocumentChunks } = buildProcessor();
    embedDocumentChunks.execute.mockResolvedValue(0);

    await expect(
      processor.process(buildJob({ documentId, knowledgeBaseId })),
    ).resolves.toBeUndefined();
  });

  it('routes a reembed-knowledge-base job to ReembedKnowledgeBaseProcessor', async () => {
    const { processor, reembedProcessor, embedDocumentChunks } =
      buildProcessor();
    const job = {
      name: 'reembed-knowledge-base',
      data: { knowledgeBaseId, previousModel: 'a', newModel: 'b' },
    } as Job;

    await processor.process(job);

    expect(reembedProcessor.process).toHaveBeenCalledWith(job);
    expect(embedDocumentChunks.execute).not.toHaveBeenCalled();
  });
});
