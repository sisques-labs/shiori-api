import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TenancyModule } from '@core/tenancy/tenancy.module';

import { DeleteEmbeddingsByDocumentCommandHandler } from './application/commands/delete-embeddings-by-document/delete-embeddings-by-document.handler';
import { DeleteEmbeddingsByKnowledgeBaseCommandHandler } from './application/commands/delete-embeddings-by-knowledge-base/delete-embeddings-by-knowledge-base.handler';
import { CHUNK_SOURCE_PORT } from './application/ports/chunk-source.port';
import { EMBEDDING_PORT } from './application/ports/embedding.port';
import { EMBEDDING_PROCESSING_QUEUE_PORT } from './application/ports/embedding-processing-queue.port';
import { EmbeddingSearchQueryHandler } from './application/queries/embedding-search/embedding-search.handler';
import { EmbeddingBuilder } from './domain/builders/embedding.builder';
import { EMBEDDING_READ_REPOSITORY } from './domain/repositories/read/embedding-read.repository';
import { EMBEDDING_WRITE_REPOSITORY } from './domain/repositories/write/embedding-write.repository';
import { DocumentChunkSourceAdapter } from './infrastructure/adapters/document-chunk-source.adapter';
import { DocumentChunkedListener } from './infrastructure/adapters/document-chunked.listener';
import { DocumentChunkingStartedListener } from './infrastructure/adapters/document-chunking-started.listener';
import { DocumentDeletedListener } from './infrastructure/adapters/document-deleted.listener';
import { KnowledgeBaseDeletedListener } from './infrastructure/adapters/knowledge-base-deleted.listener';
import { embeddingsConfig } from './infrastructure/config/embeddings.config';
import { EmbeddingTypeOrmEntity } from './infrastructure/persistence/typeorm/entities/embedding.entity';
import { EmbeddingTypeOrmMapper } from './infrastructure/persistence/typeorm/mappers/embedding-typeorm.mapper';
import { EmbeddingTypeOrmReadRepository } from './infrastructure/persistence/typeorm/repositories/embedding-typeorm-read.repository';
import { EmbeddingTypeOrmWriteRepository } from './infrastructure/persistence/typeorm/repositories/embedding-typeorm-write.repository';
import { EmbedDocumentChunksProcessor } from './infrastructure/processors/embed-document-chunks.processor';
import { BullmqEmbeddingProcessingQueueService } from './infrastructure/services/bullmq-embedding-processing-queue.service';
import { OpenAiCompatibleEmbeddingService } from './infrastructure/services/openai-compatible-embedding.service';

const COMMAND_HANDLERS = [
  DeleteEmbeddingsByDocumentCommandHandler,
  DeleteEmbeddingsByKnowledgeBaseCommandHandler,
];

const QUERY_HANDLERS = [EmbeddingSearchQueryHandler];

const DOMAIN_BUILDERS = [EmbeddingBuilder];

const INFRASTRUCTURE_MAPPERS = [EmbeddingTypeOrmMapper];

const INFRASTRUCTURE_REPOSITORIES = [
  {
    provide: EMBEDDING_WRITE_REPOSITORY,
    useClass: EmbeddingTypeOrmWriteRepository,
  },
  {
    provide: EMBEDDING_READ_REPOSITORY,
    useClass: EmbeddingTypeOrmReadRepository,
  },
];

const INFRASTRUCTURE_PORTS = [
  { provide: EMBEDDING_PORT, useClass: OpenAiCompatibleEmbeddingService },
  {
    provide: EMBEDDING_PROCESSING_QUEUE_PORT,
    useClass: BullmqEmbeddingProcessingQueueService,
  },
  { provide: CHUNK_SOURCE_PORT, useClass: DocumentChunkSourceAdapter },
];

// EmbedDocumentChunksProcessor is discovered by BullMQ via its own
// @Processor() decorator, not by anything in this array — it's still
// declared as a regular provider so Nest's DI container can construct it.
const INFRASTRUCTURE_ADAPTERS = [
  DocumentChunkedListener,
  DocumentChunkingStartedListener,
  DocumentDeletedListener,
  KnowledgeBaseDeletedListener,
  EmbedDocumentChunksProcessor,
];

@Module({
  imports: [
    CqrsModule,
    TenancyModule,
    HttpModule,
    ConfigModule.forFeature(embeddingsConfig),
    TypeOrmModule.forFeature([EmbeddingTypeOrmEntity]),
    BullModule.registerQueue({ name: 'embeddings' }),
  ],
  providers: [
    ...COMMAND_HANDLERS,
    ...QUERY_HANDLERS,
    ...DOMAIN_BUILDERS,
    ...INFRASTRUCTURE_MAPPERS,
    ...INFRASTRUCTURE_REPOSITORIES,
    ...INFRASTRUCTURE_PORTS,
    ...INFRASTRUCTURE_ADAPTERS,
  ],
  exports: [],
})
export class EmbeddingsModule {}
