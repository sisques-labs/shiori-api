import { randomUUID } from 'crypto';

import {
  createIntegrationModule,
  IntegrationContext,
} from '../../helpers/integration-bootstrap';
import { truncateAll } from '../../helpers/db-reset';
import { KnowledgeBasesModule } from '../../../src/contexts/knowledge-bases/knowledge-bases.module';
import { KnowledgeBaseBuilder } from '../../../src/contexts/knowledge-bases/domain/builders/knowledge-base.builder';
import {
  KNOWLEDGE_BASE_WRITE_REPOSITORY,
  IKnowledgeBaseWriteRepository,
} from '../../../src/contexts/knowledge-bases/domain/repositories/write/knowledge-base-write.repository';

const NOW = new Date('2024-06-01T00:00:00.000Z');

function buildKnowledgeBase(overrides?: {
  name?: string;
  description?: string | null;
  apiKeyHash?: string;
}) {
  return new KnowledgeBaseBuilder()
    .withId(randomUUID())
    .withName(overrides?.name ?? 'Docs')
    .withDescription(
      overrides?.description !== undefined ? overrides.description : null,
    )
    .withApiKeyHash(overrides?.apiKeyHash ?? 'a'.repeat(64))
    .withEmbeddingModel('text-embedding-3-small')
    .withCreatedAt(NOW)
    .withUpdatedAt(NOW)
    .build();
}

describe('KnowledgeBaseTypeOrmWriteRepository (integration)', () => {
  let ctx: IntegrationContext;
  let writeRepo: IKnowledgeBaseWriteRepository;

  beforeAll(async () => {
    ctx = await createIntegrationModule({ imports: [KnowledgeBasesModule] });
    writeRepo = ctx.module.get(KNOWLEDGE_BASE_WRITE_REPOSITORY);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
  });

  describe('save() and findById()', () => {
    it('round-trips all fields including a description', async () => {
      const kb = buildKnowledgeBase({ description: 'Internal docs' });

      const saved = await writeRepo.save(kb);
      const found = await writeRepo.findById(saved.id.value);

      expect(found).not.toBeNull();
      expect(found!.name.value).toBe('Docs');
      expect(found!.description?.value).toBe('Internal docs');
      expect(found!.apiKeyHash.value).toBe('a'.repeat(64));
    });

    it('round-trips a knowledge base with a null description', async () => {
      const kb = buildKnowledgeBase({ description: null });

      const saved = await writeRepo.save(kb);
      const found = await writeRepo.findById(saved.id.value);

      expect(found!.description).toBeNull();
    });

    it('findById() returns null for an unknown id', async () => {
      await expect(writeRepo.findById(randomUUID())).resolves.toBeNull();
    });

    it('enforces the unique constraint on api_key_hash', async () => {
      const sharedHash = 'b'.repeat(64);
      await writeRepo.save(buildKnowledgeBase({ apiKeyHash: sharedHash }));

      await expect(
        writeRepo.save(buildKnowledgeBase({ apiKeyHash: sharedHash })),
      ).rejects.toThrow();
    });
  });

  describe('delete()', () => {
    it('removes the record so findById returns null', async () => {
      const kb = buildKnowledgeBase();
      const saved = await writeRepo.save(kb);

      await writeRepo.delete(saved.id.value);

      await expect(writeRepo.findById(saved.id.value)).resolves.toBeNull();
    });
  });
});
