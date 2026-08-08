import { UuidValueObject } from '@sisques-labs/nestjs-kit';
import { Job } from 'bullmq';

import { IChunkSourcePort } from '@contexts/embeddings/application/ports/chunk-source.port';
import { IEmbeddingPort } from '@contexts/embeddings/application/ports/embedding.port';
import { IKnowledgeBaseReembeddingStatusPort } from '@contexts/embeddings/application/ports/knowledge-base-reembedding-status.port';
import { EmbeddingAggregate } from '@contexts/embeddings/domain/aggregates/embedding.aggregate';
import { EmbeddingBuilder } from '@contexts/embeddings/domain/builders/embedding.builder';
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
  const embeddingPort: jest.Mocked<IEmbeddingPort> = {
    embed: jest.fn(),
    embedBatch: jest.fn(),
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
  const knowledgeBaseContext = {
    run: jest.fn((_id: string, fn: () => unknown) => fn()),
  } as unknown as jest.Mocked<KnowledgeBaseContext>;

  const processor = new ReembedKnowledgeBaseProcessor(
    chunkSource,
    embeddingPort,
    embeddingWriteRepository,
    reembeddingStatus,
    new EmbeddingModelRegistryService(),
    new EmbeddingBuilder(),
    knowledgeBaseContext,
  );

  return {
    processor,
    chunkSource,
    embeddingPort,
    embeddingWriteRepository,
    reembeddingStatus,
    knowledgeBaseContext,
  };
}

function buildJob(data: ReembedKnowledgeBaseJobData): Job {
  return { name: 'reembed-knowledge-base', data } as Job;
}

describe('ReembedKnowledgeBaseProcessor', () => {
  const knowledgeBaseId = UuidValueObject.generate().value;
  const documentId1 = UuidValueObject.generate().value;
  const documentId2 = UuidValueObject.generate().value;
  const previousModel = 'text-embedding-3-small';
  const newModel = 'nomic-embed-text';

  it('happy path: clears target model first, re-embeds every document under the new model, then clears the previous model, then dispatches Complete', async () => {
    const {
      processor,
      chunkSource,
      embeddingPort,
      embeddingWriteRepository,
      reembeddingStatus,
      knowledgeBaseContext,
    } = buildProcessor();

    chunkSource.findKnowledgeBaseDocumentIds.mockResolvedValue([
      documentId1,
      documentId2,
    ]);
    chunkSource.findByDocumentId.mockImplementation(async () => [
      { id: UuidValueObject.generate().value, text: 'first', position: 0 },
    ]);
    embeddingPort.embedBatch.mockResolvedValue([new Array(768).fill(0.1)]);

    await processor.process(
      buildJob({ knowledgeBaseId, previousModel, newModel }),
    );

    expect(knowledgeBaseContext.run).toHaveBeenCalledWith(
      knowledgeBaseId,
      expect.any(Function),
    );

    // Clears the target model's rows FIRST (retry safety), before any
    // document is re-embedded.
    const deleteCalls =
      embeddingWriteRepository.deleteByKnowledgeBaseIdAndModel.mock.calls;
    expect(deleteCalls[0]).toEqual([knowledgeBaseId, newModel]);

    expect(embeddingPort.embedBatch).toHaveBeenCalledTimes(2);
    expect(embeddingPort.embedBatch).toHaveBeenCalledWith(['first'], newModel);

    expect(embeddingWriteRepository.saveMany).toHaveBeenCalledTimes(2);
    const [savedEmbeddings, dimensions] = embeddingWriteRepository.saveMany.mock
      .calls[0] as [EmbeddingAggregate[], number];
    expect(dimensions).toBe(768);
    expect(savedEmbeddings[0].model.value).toBe(newModel);

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
      embeddingPort,
      embeddingWriteRepository,
      reembeddingStatus,
    } = buildProcessor();

    chunkSource.findKnowledgeBaseDocumentIds.mockResolvedValue([
      documentId1,
      documentId2,
    ]);
    chunkSource.findByDocumentId.mockResolvedValue([
      { id: UuidValueObject.generate().value, text: 'first', position: 0 },
    ]);
    embeddingPort.embedBatch.mockRejectedValue(new Error('provider timeout'));

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

  it('skips documents with no chunks without failing the job', async () => {
    const { processor, chunkSource, embeddingPort, embeddingWriteRepository } =
      buildProcessor();

    chunkSource.findKnowledgeBaseDocumentIds.mockResolvedValue([documentId1]);
    chunkSource.findByDocumentId.mockResolvedValue([]);

    await processor.process(
      buildJob({ knowledgeBaseId, previousModel, newModel }),
    );

    expect(embeddingPort.embedBatch).not.toHaveBeenCalled();
    expect(embeddingWriteRepository.saveMany).not.toHaveBeenCalled();
  });
});
