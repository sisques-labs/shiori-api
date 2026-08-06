import { randomUUID } from 'crypto';

import {
  createIntegrationModule,
  IntegrationContext,
} from '../../helpers/integration-bootstrap';
import { truncateAll } from '../../helpers/db-reset';
import { DocumentsModule } from '../../../src/contexts/documents/documents.module';
import { DocumentBuilder } from '../../../src/contexts/documents/domain/builders/document.builder';
import { DocumentStatusEnum } from '../../../src/contexts/documents/domain/enums/document-status.enum';
import {
  DOCUMENT_WRITE_REPOSITORY,
  IDocumentWriteRepository,
} from '../../../src/contexts/documents/domain/repositories/write/document-write.repository';
import { KnowledgeBaseContext } from '../../../src/core/tenancy/knowledge-base-context.service';

const NOW = new Date('2024-06-01T00:00:00.000Z');

function buildDocument(
  knowledgeBaseId: string,
  overrides?: { title?: string; status?: DocumentStatusEnum },
) {
  return new DocumentBuilder()
    .withId(randomUUID())
    .withKnowledgeBaseId(knowledgeBaseId)
    .withTitle(overrides?.title ?? 'Doc')
    .withContent('Some content')
    .withStatus(overrides?.status ?? DocumentStatusEnum.PENDING)
    .withCreatedAt(NOW)
    .withUpdatedAt(NOW)
    .build();
}

describe('DocumentTypeOrmWriteRepository (integration)', () => {
  let ctx: IntegrationContext;
  let writeRepo: IDocumentWriteRepository;
  let knowledgeBaseContext: KnowledgeBaseContext;

  beforeAll(async () => {
    ctx = await createIntegrationModule({ imports: [DocumentsModule] });
    writeRepo = ctx.module.get(DOCUMENT_WRITE_REPOSITORY);
    knowledgeBaseContext = ctx.module.get(KnowledgeBaseContext);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
  });

  describe('save() and findById()', () => {
    it('round-trips all fields', async () => {
      const knowledgeBaseId = randomUUID();
      const doc = buildDocument(knowledgeBaseId, { title: 'My Doc' });

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        const saved = await writeRepo.save(doc);
        const found = await writeRepo.findById(saved.id.value);

        expect(found).not.toBeNull();
        expect(found!.title.value).toBe('My Doc');
        expect(found!.content.value).toBe('Some content');
        expect(found!.status.value).toBe(DocumentStatusEnum.PENDING);
        expect(found!.knowledgeBaseId.value).toBe(knowledgeBaseId);
      });
    });

    it('findById() returns null for an unknown id', async () => {
      const knowledgeBaseId = randomUUID();

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await expect(writeRepo.findById(randomUUID())).resolves.toBeNull();
      });
    });
  });

  describe('tenant isolation', () => {
    it('does not resolve a document belonging to a different knowledge base', async () => {
      const kbOneId = randomUUID();
      const kbTwoId = randomUUID();

      const docInKbOne = await knowledgeBaseContext.run(kbOneId, () =>
        writeRepo.save(buildDocument(kbOneId, { title: 'KB One Doc' })),
      );

      await knowledgeBaseContext.run(kbTwoId, async () => {
        await expect(
          writeRepo.findById(docInKbOne.id.value),
        ).resolves.toBeNull();
      });
    });
  });

  describe('delete()', () => {
    it('removes the record so findById returns null', async () => {
      const knowledgeBaseId = randomUUID();
      const doc = buildDocument(knowledgeBaseId);

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        const saved = await writeRepo.save(doc);

        await writeRepo.delete(saved.id.value);

        await expect(writeRepo.findById(saved.id.value)).resolves.toBeNull();
      });
    });
  });
});
