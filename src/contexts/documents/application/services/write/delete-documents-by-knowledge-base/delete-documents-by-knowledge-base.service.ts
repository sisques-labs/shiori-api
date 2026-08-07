import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Criteria,
  IBaseService,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';

import { DocumentAggregate } from '@contexts/documents/domain/aggregates/document.aggregate';
import {
  DOCUMENT_WRITE_REPOSITORY,
  IDocumentWriteRepository,
} from '@contexts/documents/domain/repositories/write/document-write.repository';
import {
  CHUNK_WRITE_REPOSITORY,
  IChunkWriteRepository,
} from '@contexts/documents/domain/repositories/write/chunk-write.repository';

const DELETE_BATCH_SIZE = 100;

@Injectable()
export class DeleteDocumentsByKnowledgeBaseService implements IBaseService<
  string,
  void
> {
  private readonly logger = new Logger(
    DeleteDocumentsByKnowledgeBaseService.name,
  );

  constructor(
    @Inject(DOCUMENT_WRITE_REPOSITORY)
    private readonly writeRepository: IDocumentWriteRepository,
    @Inject(CHUNK_WRITE_REPOSITORY)
    private readonly chunkWriteRepository: IChunkWriteRepository,
  ) {}

  async execute(knowledgeBaseId: string): Promise<void> {
    let deleted = 0;
    let page: PaginatedResult<DocumentAggregate>;

    do {
      page = await this.fetchNextBatch();

      for (const document of page.items) {
        await this.chunkWriteRepository.deleteByDocumentId(document.id.value);
        await this.writeRepository.delete(document.id.value);
        deleted += 1;
      }
    } while (page.items.length > 0);

    this.logger.log(
      `Deleted ${deleted} documents for knowledge base: ${knowledgeBaseId}`,
    );
  }

  private fetchNextBatch(): Promise<PaginatedResult<DocumentAggregate>> {
    return this.writeRepository.findByCriteria(
      new Criteria([], [], { page: 1, perPage: DELETE_BATCH_SIZE }),
    );
  }
}
