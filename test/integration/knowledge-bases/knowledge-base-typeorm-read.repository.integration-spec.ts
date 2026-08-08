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
import {
  KNOWLEDGE_BASE_READ_REPOSITORY,
  IKnowledgeBaseReadRepository,
} from '../../../src/contexts/knowledge-bases/domain/repositories/read/knowledge-base-read.repository';

const NOW = new Date('2024-06-01T00:00:00.000Z');

describe('KnowledgeBaseTypeOrmReadRepository (integration)', () => {
  let ctx: IntegrationContext;
  let writeRepo: IKnowledgeBaseWriteRepository;
  let readRepo: IKnowledgeBaseReadRepository;

  beforeAll(async () => {
    ctx = await createIntegrationModule({ imports: [KnowledgeBasesModule] });
    writeRepo = ctx.module.get(KNOWLEDGE_BASE_WRITE_REPOSITORY);
    readRepo = ctx.module.get(KNOWLEDGE_BASE_READ_REPOSITORY);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
  });

  describe('findByApiKeyHash()', () => {
    it('returns the matching knowledge base', async () => {
      const hash = 'c'.repeat(64);
      const kb = new KnowledgeBaseBuilder()
        .withId(randomUUID())
        .withName('Docs')
        .withApiKeyHash(hash)
        .withEmbeddingModel('text-embedding-3-small')
        .withCreatedAt(NOW)
        .withUpdatedAt(NOW)
        .build();
      const saved = await writeRepo.save(kb);

      const found = await readRepo.findByApiKeyHash(hash);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(saved.id.value);
    });

    it('returns null for a hash that does not exist', async () => {
      await expect(
        readRepo.findByApiKeyHash('d'.repeat(64)),
      ).resolves.toBeNull();
    });
  });

  describe('findById()', () => {
    it('returns the view model without leaking a mismatched apiKeyHash', async () => {
      const kb = new KnowledgeBaseBuilder()
        .withId(randomUUID())
        .withName('Docs')
        .withApiKeyHash('e'.repeat(64))
        .withEmbeddingModel('text-embedding-3-small')
        .withCreatedAt(NOW)
        .withUpdatedAt(NOW)
        .build();
      const saved = await writeRepo.save(kb);

      const found = await readRepo.findById(saved.id.value);

      expect(found!.apiKeyHash).toBe('e'.repeat(64));
    });
  });
});
