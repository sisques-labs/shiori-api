import { ConfigService } from '@nestjs/config';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';
import { Job } from 'bullmq';

import { IChunkSourcePort } from '@contexts/retrieval/application/ports/chunk-source.port';
import { IEmbeddingPort } from '@contexts/retrieval/application/ports/embedding.port';
import { EmbeddingAggregate } from '@contexts/retrieval/domain/aggregates/embedding.aggregate';
import { EmbeddingBuilder } from '@contexts/retrieval/domain/builders/embedding.builder';
import { IEmbeddingWriteRepository } from '@contexts/retrieval/domain/repositories/write/embedding-write.repository';
import { EMBEDDING_VECTOR_DIMENSIONS } from '@contexts/retrieval/domain/value-objects/embedding-vector/embedding-vector.value-object';
import { KnowledgeBaseContext } from '@core/tenancy/knowledge-base-context.service';

import {
  EmbedDocumentChunksJobData,
  EmbedDocumentChunksProcessor,
} from './embed-document-chunks.processor';

function vector(fill = 0.1): number[] {
  return new Array(EMBEDDING_VECTOR_DIMENSIONS).fill(fill);
}

function buildProcessor() {
  const chunkSource: jest.Mocked<IChunkSourcePort> = {
    findByDocumentId: jest.fn(),
  };
  const embeddingPort: jest.Mocked<IEmbeddingPort> = {
    embed: jest.fn(),
    embedBatch: jest.fn(),
  };
  const embeddingWriteRepository: jest.Mocked<IEmbeddingWriteRepository> = {
    saveMany: jest.fn(),
    deleteByDocumentId: jest.fn(),
    deleteByKnowledgeBaseId: jest.fn(),
  };
  const knowledgeBaseContext = {
    run: jest.fn((_id: string, fn: () => unknown) => fn()),
  } as unknown as jest.Mocked<KnowledgeBaseContext>;
  const configService = {
    getOrThrow: jest.fn().mockReturnValue({ embeddingModel: 'test-model' }),
  } as unknown as ConfigService;

  const processor = new EmbedDocumentChunksProcessor(
    chunkSource,
    embeddingPort,
    embeddingWriteRepository,
    new EmbeddingBuilder(),
    knowledgeBaseContext,
    configService,
  );

  return {
    processor,
    chunkSource,
    embeddingPort,
    embeddingWriteRepository,
    knowledgeBaseContext,
  };
}

function buildJob(
  data: EmbedDocumentChunksJobData,
): Job<EmbedDocumentChunksJobData> {
  return { data } as Job<EmbedDocumentChunksJobData>;
}

describe('EmbedDocumentChunksProcessor', () => {
  const documentId = UuidValueObject.generate().value;
  const knowledgeBaseId = UuidValueObject.generate().value;
  const chunkId1 = UuidValueObject.generate().value;
  const chunkId2 = UuidValueObject.generate().value;

  it('opens the tenancy frame with the job knowledgeBaseId and saves an embedding per chunk', async () => {
    const {
      processor,
      chunkSource,
      embeddingPort,
      embeddingWriteRepository,
      knowledgeBaseContext,
    } = buildProcessor();

    chunkSource.findByDocumentId.mockResolvedValue([
      { id: chunkId1, text: 'first', position: 0 },
      { id: chunkId2, text: 'second', position: 1 },
    ]);
    embeddingPort.embedBatch.mockResolvedValue([vector(0.1), vector(0.2)]);

    await processor.process(buildJob({ documentId, knowledgeBaseId }));

    expect(knowledgeBaseContext.run).toHaveBeenCalledWith(
      knowledgeBaseId,
      expect.any(Function),
    );
    expect(embeddingPort.embedBatch).toHaveBeenCalledWith(['first', 'second']);
    expect(embeddingWriteRepository.saveMany).toHaveBeenCalledTimes(1);

    const saved = embeddingWriteRepository.saveMany.mock
      .calls[0][0] as EmbeddingAggregate[];
    expect(saved).toHaveLength(2);
    expect(saved[0].chunkId.value).toBe(chunkId1);
    expect(saved[0].chunkText.value).toBe('first');
    expect(saved[0].embedding.value).toEqual(vector(0.1));
    expect(saved[0].model.value).toBe('test-model');
    expect(saved[1].chunkId.value).toBe(chunkId2);
  });

  it('does nothing (no embed call, no save) when the document has no chunks', async () => {
    const { processor, chunkSource, embeddingPort, embeddingWriteRepository } =
      buildProcessor();
    chunkSource.findByDocumentId.mockResolvedValue([]);

    await processor.process(buildJob({ documentId, knowledgeBaseId }));

    expect(embeddingPort.embedBatch).not.toHaveBeenCalled();
    expect(embeddingWriteRepository.saveMany).not.toHaveBeenCalled();
  });
});
