import { QueryBus } from '@nestjs/cqrs';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { KnowledgeBaseFindByIdQuery } from '@contexts/knowledge-bases/application/queries/knowledge-base-find-by-id/knowledge-base-find-by-id.query';
import { KnowledgeBaseNotFoundException } from '@contexts/knowledge-bases/domain/exceptions/knowledge-base-not-found.exception';
import { KnowledgeBaseViewModel } from '@contexts/knowledge-bases/domain/view-models/knowledge-base.view-model';

import { KnowledgeBaseEmbeddingConfigAdapter } from './knowledge-base-embedding-config.adapter';

describe('KnowledgeBaseEmbeddingConfigAdapter', () => {
  let queryBus: jest.Mocked<QueryBus>;
  let adapter: KnowledgeBaseEmbeddingConfigAdapter;

  beforeEach(() => {
    queryBus = { execute: jest.fn() } as unknown as jest.Mocked<QueryBus>;
    adapter = new KnowledgeBaseEmbeddingConfigAdapter(queryBus);
  });

  it('dispatches KnowledgeBaseFindByIdQuery and maps the embedding config', async () => {
    const knowledgeBaseId = UuidValueObject.generate().value;
    const viewModel = new KnowledgeBaseViewModel({
      id: knowledgeBaseId,
      name: 'Docs',
      description: null,
      apiKeyHash: 'a'.repeat(64),
      embeddingModel: 'text-embedding-3-small',
      embeddingStatus: 'READY',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    queryBus.execute.mockResolvedValue(viewModel);

    const config = await adapter.getByKnowledgeBaseId(knowledgeBaseId);

    expect(queryBus.execute).toHaveBeenCalledWith(
      expect.any(KnowledgeBaseFindByIdQuery),
    );
    const dispatchedQuery = queryBus.execute.mock
      .calls[0][0] as KnowledgeBaseFindByIdQuery;
    expect(dispatchedQuery.id).toBe(knowledgeBaseId);
    expect(config).toEqual({
      embeddingModel: 'text-embedding-3-small',
      embeddingStatus: 'READY',
    });
  });

  it('throws KnowledgeBaseNotFoundException when no knowledge base is found', async () => {
    queryBus.execute.mockResolvedValue(null);

    await expect(
      adapter.getByKnowledgeBaseId(UuidValueObject.generate().value),
    ).rejects.toBeInstanceOf(KnowledgeBaseNotFoundException);
  });
});
