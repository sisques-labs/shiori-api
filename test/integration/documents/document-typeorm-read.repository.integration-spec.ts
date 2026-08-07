import { randomUUID } from 'crypto';
import {
  Criteria,
  FilterOperator,
  SortDirection,
} from '@sisques-labs/nestjs-kit';

import {
  createIntegrationModule,
  IntegrationContext,
} from '../../helpers/integration-bootstrap';
import { truncateAll } from '../../helpers/db-reset';
import { insertKnowledgeBaseFixture } from '../../helpers/fixtures';
import { DocumentsModule } from '../../../src/contexts/documents/documents.module';
import { DocumentBuilder } from '../../../src/contexts/documents/domain/builders/document.builder';
import { DocumentStatusEnum } from '../../../src/contexts/documents/domain/enums/document-status.enum';
import {
  DOCUMENT_WRITE_REPOSITORY,
  IDocumentWriteRepository,
} from '../../../src/contexts/documents/domain/repositories/write/document-write.repository';
import {
  DOCUMENT_READ_REPOSITORY,
  IDocumentReadRepository,
} from '../../../src/contexts/documents/domain/repositories/read/document-read.repository';
import { KnowledgeBaseContext } from '../../../src/core/tenancy/knowledge-base-context.service';

function buildDocument(
  knowledgeBaseId: string,
  overrides: { title?: string; status?: DocumentStatusEnum; createdAt?: Date },
) {
  return new DocumentBuilder()
    .withId(randomUUID())
    .withKnowledgeBaseId(knowledgeBaseId)
    .withTitle(overrides.title ?? 'Doc')
    .withContent('Some content')
    .withStatus(overrides.status ?? DocumentStatusEnum.PENDING)
    .withCreatedAt(overrides.createdAt ?? new Date())
    .withUpdatedAt(overrides.createdAt ?? new Date())
    .build();
}

describe('DocumentTypeOrmReadRepository (integration)', () => {
  let ctx: IntegrationContext;
  let writeRepo: IDocumentWriteRepository;
  let readRepo: IDocumentReadRepository;
  let knowledgeBaseContext: KnowledgeBaseContext;

  beforeAll(async () => {
    ctx = await createIntegrationModule({ imports: [DocumentsModule] });
    writeRepo = ctx.module.get(DOCUMENT_WRITE_REPOSITORY);
    readRepo = ctx.module.get(DOCUMENT_READ_REPOSITORY);
    knowledgeBaseContext = ctx.module.get(KnowledgeBaseContext);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
  });

  describe('findById()', () => {
    it('returns the view model', async () => {
      const knowledgeBaseId = randomUUID();
      const doc = buildDocument(knowledgeBaseId, { title: 'My Doc' });
      await insertKnowledgeBaseFixture(ctx.dataSource, knowledgeBaseId);

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        const saved = await writeRepo.save(doc);
        const found = await readRepo.findById(saved.id.value);

        expect(found).not.toBeNull();
        expect(found!.title).toBe('My Doc');
        expect(found!.knowledgeBaseId).toBe(knowledgeBaseId);
      });
    });

    it('does not resolve a document belonging to a different knowledge base', async () => {
      const kbOneId = randomUUID();
      const kbTwoId = randomUUID();
      await insertKnowledgeBaseFixture(ctx.dataSource, kbOneId);

      const docInKbOne = await knowledgeBaseContext.run(kbOneId, () =>
        writeRepo.save(buildDocument(kbOneId, { title: 'KB One Doc' })),
      );

      await knowledgeBaseContext.run(kbTwoId, async () => {
        await expect(
          readRepo.findById(docInKbOne.id.value),
        ).resolves.toBeNull();
      });
    });
  });

  describe('findByCriteria()', () => {
    it('scopes results to the current knowledge base only', async () => {
      const kbOneId = randomUUID();
      const kbTwoId = randomUUID();
      await insertKnowledgeBaseFixture(ctx.dataSource, kbOneId);
      await insertKnowledgeBaseFixture(ctx.dataSource, kbTwoId);

      await knowledgeBaseContext.run(kbOneId, () =>
        writeRepo.save(buildDocument(kbOneId, { title: 'KB One Doc' })),
      );
      await knowledgeBaseContext.run(kbTwoId, () =>
        writeRepo.save(buildDocument(kbTwoId, { title: 'KB Two Doc' })),
      );

      await knowledgeBaseContext.run(kbOneId, async () => {
        const result = await readRepo.findByCriteria(new Criteria());

        expect(result.items).toHaveLength(1);
        expect(result.items[0].title).toBe('KB One Doc');
      });
    });

    it('applies a filter on status', async () => {
      const knowledgeBaseId = randomUUID();
      await insertKnowledgeBaseFixture(ctx.dataSource, knowledgeBaseId);

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await writeRepo.save(
          buildDocument(knowledgeBaseId, {
            title: 'Chunked doc',
            status: DocumentStatusEnum.CHUNKED,
          }),
        );
        await writeRepo.save(
          buildDocument(knowledgeBaseId, {
            title: 'Pending doc',
            status: DocumentStatusEnum.PENDING,
          }),
        );

        const result = await readRepo.findByCriteria(
          new Criteria([
            {
              field: 'status',
              operator: FilterOperator.EQUALS,
              value: DocumentStatusEnum.CHUNKED,
            },
          ]),
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0].title).toBe('Chunked doc');
      });
    });

    it('applies a sort on title', async () => {
      const knowledgeBaseId = randomUUID();
      await insertKnowledgeBaseFixture(ctx.dataSource, knowledgeBaseId);

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        await writeRepo.save(
          buildDocument(knowledgeBaseId, { title: 'Zebra' }),
        );
        await writeRepo.save(
          buildDocument(knowledgeBaseId, { title: 'Apple' }),
        );

        const result = await readRepo.findByCriteria(
          new Criteria([], [{ field: 'title', direction: SortDirection.ASC }]),
        );

        expect(result.items.map((i) => i.title)).toEqual(['Apple', 'Zebra']);
      });
    });

    it('paginates results', async () => {
      const knowledgeBaseId = randomUUID();
      await insertKnowledgeBaseFixture(ctx.dataSource, knowledgeBaseId);

      await knowledgeBaseContext.run(knowledgeBaseId, async () => {
        for (let i = 0; i < 5; i++) {
          await writeRepo.save(
            buildDocument(knowledgeBaseId, { title: `Doc ${i}` }),
          );
        }

        const page1 = await readRepo.findByCriteria(
          new Criteria([], [], { page: 1, perPage: 2 }),
        );
        const page2 = await readRepo.findByCriteria(
          new Criteria([], [], { page: 2, perPage: 2 }),
        );

        expect(page1.items).toHaveLength(2);
        expect(page2.items).toHaveLength(2);
        expect(page1.total).toBe(5);
        expect(page1.items[0].id).not.toBe(page2.items[0].id);
      });
    });
  });
});
