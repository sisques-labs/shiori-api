import { randomUUID } from 'crypto';

import {
  createIntegrationModule,
  IntegrationContext,
} from '../../helpers/integration-bootstrap';
import { truncateAll } from '../../helpers/db-reset';
import { DocumentsModule } from '../../../src/contexts/documents/documents.module';
import { ChunkBuilder } from '../../../src/contexts/documents/domain/builders/chunk.builder';
import {
  CHUNK_WRITE_REPOSITORY,
  IChunkWriteRepository,
} from '../../../src/contexts/documents/domain/repositories/write/chunk-write.repository';
import { KnowledgeBaseContext } from '../../../src/core/tenancy/knowledge-base-context.service';

function buildChunk(
  knowledgeBaseId: string,
  documentId: string,
  position: number,
  text = `chunk ${position}`,
) {
  return new ChunkBuilder()
    .withId(randomUUID())
    .withDocumentId(documentId)
    .withKnowledgeBaseId(knowledgeBaseId)
    .withPosition(position)
    .withText(text)
    .withCreatedAt(new Date())
    .build();
}

describe('ChunkTypeOrmWriteRepository (integration)', () => {
  let ctx: IntegrationContext;
  let chunkWriteRepo: IChunkWriteRepository;
  let knowledgeBaseContext: KnowledgeBaseContext;

  beforeAll(async () => {
    ctx = await createIntegrationModule({ imports: [DocumentsModule] });
    chunkWriteRepo = ctx.module.get(CHUNK_WRITE_REPOSITORY);
    knowledgeBaseContext = ctx.module.get(KnowledgeBaseContext);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
  });

  describe('saveMany() and findByDocumentId()', () => {
    it('persists all chunks and returns them ordered by position', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        const chunks = [
          buildChunk(knowledgeBaseId, documentId, 2, 'third'),
          buildChunk(knowledgeBaseId, documentId, 0, 'first'),
          buildChunk(knowledgeBaseId, documentId, 1, 'second'),
        ];

        await chunkWriteRepo.saveMany(chunks);

        const found = await chunkWriteRepo.findByDocumentId(documentId);

        expect(found).toHaveLength(3);
        expect(found.map((c) => c.position.value)).toEqual([0, 1, 2]);
        expect(found.map((c) => c.text.value)).toEqual([
          'first',
          'second',
          'third',
        ]);
      });
    });

    it('saveMany() with an empty array is a no-op', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await expect(chunkWriteRepo.saveMany([])).resolves.toBeUndefined();
        await expect(
          chunkWriteRepo.findByDocumentId(documentId),
        ).resolves.toEqual([]);
      });
    });

    it('does not resolve chunks belonging to a different knowledge base', async () => {
      const kbOneId = randomUUID();
      const kbTwoId = randomUUID();
      const documentId = randomUUID();

      await knowledgeBaseContext.run(kbOneId, () =>
        chunkWriteRepo.saveMany([buildChunk(kbOneId, documentId, 0)]),
      );

      await knowledgeBaseContext.run(kbTwoId, async () => {
        await expect(
          chunkWriteRepo.findByDocumentId(documentId),
        ).resolves.toEqual([]);
      });
    });
  });

  describe('deleteByDocumentId()', () => {
    it('removes all chunks for the document', async () => {
      const knowledgeBaseId = randomUUID();
      const documentId = randomUUID();

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await chunkWriteRepo.saveMany([
          buildChunk(knowledgeBaseId, documentId, 0),
          buildChunk(knowledgeBaseId, documentId, 1),
        ]);

        await chunkWriteRepo.deleteByDocumentId(documentId);

        await expect(
          chunkWriteRepo.findByDocumentId(documentId),
        ).resolves.toEqual([]);
      });
    });

    it('does not remove chunks for other documents', async () => {
      const knowledgeBaseId = randomUUID();
      const documentIdOne = randomUUID();
      const documentIdTwo = randomUUID();

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await chunkWriteRepo.saveMany([
          buildChunk(knowledgeBaseId, documentIdOne, 0),
        ]);
        await chunkWriteRepo.saveMany([
          buildChunk(knowledgeBaseId, documentIdTwo, 0),
        ]);

        await chunkWriteRepo.deleteByDocumentId(documentIdOne);

        await expect(
          chunkWriteRepo.findByDocumentId(documentIdOne),
        ).resolves.toEqual([]);
        await expect(
          chunkWriteRepo.findByDocumentId(documentIdTwo),
        ).resolves.toHaveLength(1);
      });
    });
  });
});
