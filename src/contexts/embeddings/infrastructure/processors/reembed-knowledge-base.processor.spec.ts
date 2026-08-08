import { UuidValueObject } from '@sisques-labs/nestjs-kit';
import { Job } from 'bullmq';

import { IChunkSourcePort } from '@contexts/embeddings/application/ports/chunk-source.port';
import { IKnowledgeBaseReembeddingStatusPort } from '@contexts/embeddings/application/ports/knowledge-base-reembedding-status.port';
import { EmbedDocumentChunksService } from '@contexts/embeddings/application/services/write/embed-document-chunks/embed-document-chunks.service';
import { IEmbeddingWriteRepository } from '@contexts/embeddings/domain/repositories/write/embedding-write.repository';
import { EmbeddingModelRegistryService } from '@contexts/embeddings/domain/services/embedding-model-registry.service';
import { ReembedKnowledgeBaseJobData } from '@contexts/embeddings/infrastructure/services/bullmq-embedding-reembed-queue.service';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

import { ReembedKnowledgeBaseProcessor } from './reembed-knowledge-base.processor';

function buildProcessor() {
  const chunkSource: jest.Mocked<IChunkSourcePort> = {
    findByDocumentId: jest.fn(),
    findKnowledgeBaseDocumentIds: jest.fn(),
  };
  const embeddingWriteRepository: jest.Mocked<IEmbeddingWriteRepository> = {
    saveMany: jest.fn().mockResolvedValue(undefined),
    deleteByDocumentId: jest.fn(),
    deleteByKnowledgeBaseId: jest.fn(),
    deleteByKnowledgeBaseIdAndModel: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    findByCriteria: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const reembeddingStatus: jest.Mocked<IKnowledgeBaseReembeddingStatusPort> = {
    complete: jest.fn().mockResolvedValue(undefined),
    fail: jest.fn().mockResolvedValue(undefined),
  };
  const embedDocumentChunks = {
    execute: jest.fn().mockResolvedValue(1),
  } as unknown as jest.Mocked<EmbedDocumentChunksService>;
  const knowledgeBaseContext = {
    run: jest.fn((_id: string, fn: () => unknown) => fn()),
  } as unknown as jest.Mocked<KnowledgeBaseContext>;

  const processor = new ReembedKnowledgeBaseProcessor(
    chunkSource,
    embeddingWriteRepository,
    reembeddingStatus,
    new EmbeddingModelRegistryService(),
    embedDocumentChunks,
    knowledgeBaseContext,
  );

  return {
    processor,
    chunkSource,
    embeddingWriteRepository,
    reembeddingStatus,
    embedDocumentChunks,
    knowledgeBaseContext,
  };
}

function buildJob(data: ReembedKnowledgeBaseJobData): Job {
  return {
    name: 'reembed-knowledge-base',
    data,
    updateProgress: jest.fn(),
  } as unknown as Job;
}

describe('ReembedKnowledgeBaseProcessor', () => {
  const knowledgeBaseId = UuidValueObject.generate().value;
  const documentId1 = UuidValueObject.generate().value;
  const documentId2 = UuidValueObject.generate().value;
  const previousModel = 'text-embedding-3-small';
  const newModel = 'nomic-embed-text';

  it('happy path: clears target model first, delegates each document to EmbedDocumentChunksService under the new model, then clears the previous model, then dispatches Complete', async () => {
    const {
      processor,
      chunkSource,
      embeddingWriteRepository,
      reembeddingStatus,
      embedDocumentChunks,
      knowledgeBaseContext,
    } = buildProcessor();

    chunkSource.findKnowledgeBaseDocumentIds.mockResolvedValue([
      documentId1,
      documentId2,
    ]);

    const job = buildJob({ knowledgeBaseId, previousModel, newModel });
    await processor.process(job);

    expect(knowledgeBaseContext.run).toHaveBeenCalledWith(
      knowledgeBaseId,
      expect.any(Function),
    );

    // Progress reported before the loop starts and after every document —
    // a caller polling job.progress can show "processed X of Y".
    expect(job.updateProgress).toHaveBeenCalledWith({
      processedDocuments: 0,
      totalDocuments: 2,
    });
    expect(job.updateProgress).toHaveBeenCalledWith({
      processedDocuments: 1,
      totalDocuments: 2,
    });
    expect(job.updateProgress).toHaveBeenCalledWith({
      processedDocuments: 2,
      totalDocuments: 2,
    });

    // Clears the target model's rows FIRST (retry safety), before any
    // document is re-embedded.
    const deleteCalls =
      embeddingWriteRepository.deleteByKnowledgeBaseIdAndModel.mock.calls;
    expect(deleteCalls[0]).toEqual([knowledgeBaseId, newModel]);

    expect(embedDocumentChunks.execute).toHaveBeenCalledTimes(2);
    expect(embedDocumentChunks.execute).toHaveBeenCalledWith(
      documentId1,
      knowledgeBaseId,
      newModel,
      768,
    );
    expect(embedDocumentChunks.execute).toHaveBeenCalledWith(
      documentId2,
      knowledgeBaseId,
      newModel,
      768,
    );

    // Only removed after every document succeeded.
    expect(deleteCalls[1]).toEqual([knowledgeBaseId, previousModel]);
    expect(deleteCalls).toHaveLength(2);

    expect(reembeddingStatus.complete).toHaveBeenCalledWith(knowledgeBaseId);
    expect(reembeddingStatus.fail).not.toHaveBeenCalled();
  });

  it('on failure: dispatches Fail with the error reason and never deletes the previous model’s rows', async () => {
    const {
      processor,
      chunkSource,
      embeddingWriteRepository,
      reembeddingStatus,
      embedDocumentChunks,
    } = buildProcessor();

    chunkSource.findKnowledgeBaseDocumentIds.mockResolvedValue([
      documentId1,
      documentId2,
    ]);
    embedDocumentChunks.execute.mockRejectedValue(
      new Error('provider timeout'),
    );

    await expect(
      processor.process(buildJob({ knowledgeBaseId, previousModel, newModel })),
    ).rejects.toThrow('provider timeout');

    expect(reembeddingStatus.fail).toHaveBeenCalledWith(
      knowledgeBaseId,
      'provider timeout',
    );
    expect(reembeddingStatus.complete).not.toHaveBeenCalled();

    // Only the initial "clear target model" delete happened — the previous
    // model's rows were never touched.
    expect(
      embeddingWriteRepository.deleteByKnowledgeBaseIdAndModel,
    ).toHaveBeenCalledTimes(1);
    expect(
      embeddingWriteRepository.deleteByKnowledgeBaseIdAndModel,
    ).toHaveBeenCalledWith(knowledgeBaseId, newModel);
  });

  it('tolerates a document with no chunks (EmbedDocumentChunksService is a no-op) without failing the job', async () => {
    const { processor, chunkSource, embedDocumentChunks, reembeddingStatus } =
      buildProcessor();

    chunkSource.findKnowledgeBaseDocumentIds.mockResolvedValue([documentId1]);
    embedDocumentChunks.execute.mockResolvedValue(0);

    await processor.process(
      buildJob({ knowledgeBaseId, previousModel, newModel }),
    );

    expect(embedDocumentChunks.execute).toHaveBeenCalledWith(
      documentId1,
      knowledgeBaseId,
      newModel,
      768,
    );
    expect(reembeddingStatus.complete).toHaveBeenCalledWith(knowledgeBaseId);
  });
});
