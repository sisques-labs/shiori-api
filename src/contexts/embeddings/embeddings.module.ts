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
import { EMBEDDING_REEMBED_QUEUE_PORT } from './application/ports/embedding-reembed-queue.port';
import { KNOWLEDGE_BASE_EMBEDDING_CONFIG_PORT } from './application/ports/knowledge-base-embedding-config.port';
import { KNOWLEDGE_BASE_REEMBEDDING_STATUS_PORT } from './application/ports/knowledge-base-reembedding-status.port';
import { EmbeddingAvailableModelsQueryHandler } from './application/queries/embedding-available-models/embedding-available-models.handler';
import { EmbeddingModelExistsQueryHandler } from './application/queries/embedding-model-exists/embedding-model-exists.handler';
import { EmbeddingSearchQueryHandler } from './application/queries/embedding-search/embedding-search.handler';
import { EmbeddingBuilder } from './domain/builders/embedding.builder';
import { EMBEDDING_READ_REPOSITORY } from './domain/repositories/read/embedding-read.repository';
import { EMBEDDING_WRITE_REPOSITORY } from './domain/repositories/write/embedding-write.repository';
import { EmbeddingModelRegistryService } from './domain/services/embedding-model-registry.service';
import { DocumentChunkSourceAdapter } from './infrastructure/adapters/document-chunk-source.adapter';
import { DocumentChunkedListener } from './infrastructure/adapters/document-chunked.listener';
import { DocumentChunkingStartedListener } from './infrastructure/adapters/document-chunking-started.listener';
import { DocumentDeletedListener } from './infrastructure/adapters/document-deleted.listener';
import { KnowledgeBaseDeletedListener } from './infrastructure/adapters/knowledge-base-deleted.listener';
import { KnowledgeBaseEmbeddingConfigAdapter } from './infrastructure/adapters/knowledge-base-embedding-config.adapter';
import { KnowledgeBaseEmbeddingModelChangedListener } from './infrastructure/adapters/knowledge-base-embedding-model-changed.listener';
import { KnowledgeBaseReembeddingStatusAdapter } from './infrastructure/adapters/knowledge-base-reembedding-status.adapter';
import { embeddingsConfig } from './infrastructure/config/embeddings.config';
import { EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION } from './infrastructure/persistence/typeorm/entities/embedding-vector-entity.factory';
import { EmbeddingTypeOrmEntity } from './infrastructure/persistence/typeorm/entities/embedding.entity';
import { EmbeddingTypeOrmMapper } from './infrastructure/persistence/typeorm/mappers/embedding-typeorm.mapper';
import { EmbeddingTypeOrmReadRepository } from './infrastructure/persistence/typeorm/repositories/embedding-typeorm-read.repository';
import { EmbeddingTypeOrmWriteRepository } from './infrastructure/persistence/typeorm/repositories/embedding-typeorm-write.repository';
import { EmbedDocumentChunksProcessor } from './infrastructure/processors/embed-document-chunks.processor';
import { ReembedKnowledgeBaseProcessor } from './infrastructure/processors/reembed-knowledge-base.processor';
import { BullmqEmbeddingProcessingQueueService } from './infrastructure/services/bullmq-embedding-processing-queue.service';
import { BullmqEmbeddingReembedQueueService } from './infrastructure/services/bullmq-embedding-reembed-queue.service';
import { OpenAiCompatibleEmbeddingService } from './infrastructure/services/openai-compatible-embedding.service';
import { EmbeddingModelGraphQLMapper } from './transport/graphql/mappers/embedding-model/embedding-model.mapper';
import { EmbeddingsQueriesResolver } from './transport/graphql/resolvers/embeddings-queries.resolver';
import { EmbeddingModelRestMapper } from './transport/rest/mappers/embedding-model/embedding-model.mapper';
import { EmbeddingsController } from './transport/rest/controllers/embeddings.controller';

const COMMAND_HANDLERS = [
  DeleteEmbeddingsByDocumentCommandHandler,
  DeleteEmbeddingsByKnowledgeBaseCommandHandler,
];

const QUERY_HANDLERS = [
  EmbeddingSearchQueryHandler,
  EmbeddingAvailableModelsQueryHandler,
  EmbeddingModelExistsQueryHandler,
];

const DOMAIN_SERVICES = [EmbeddingModelRegistryService];

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
  {
    provide: EMBEDDING_REEMBED_QUEUE_PORT,
    useClass: BullmqEmbeddingReembedQueueService,
  },
  { provide: CHUNK_SOURCE_PORT, useClass: DocumentChunkSourceAdapter },
  {
    provide: KNOWLEDGE_BASE_EMBEDDING_CONFIG_PORT,
    useClass: KnowledgeBaseEmbeddingConfigAdapter,
  },
  {
    provide: KNOWLEDGE_BASE_REEMBEDDING_STATUS_PORT,
    useClass: KnowledgeBaseReembeddingStatusAdapter,
  },
];

// EmbedDocumentChunksProcessor is discovered by BullMQ via its own
// @Processor() decorator, not by anything in this array — it's still
// declared as a regular provider so Nest's DI container can construct it.
// ReembedKnowledgeBaseProcessor is a plain injectable that
// EmbedDocumentChunksProcessor routes to by job name (see that file's doc
// comment for why it isn't its own @Processor()).
const INFRASTRUCTURE_ADAPTERS = [
  DocumentChunkedListener,
  DocumentChunkingStartedListener,
  DocumentDeletedListener,
  KnowledgeBaseDeletedListener,
  KnowledgeBaseEmbeddingModelChangedListener,
  ReembedKnowledgeBaseProcessor,
  EmbedDocumentChunksProcessor,
];

const REST_CONTROLLERS = [EmbeddingsController];
const REST_PROVIDERS = [EmbeddingModelRestMapper];
const GRAPHQL_PROVIDERS = [
  EmbeddingsQueriesResolver,
  EmbeddingModelGraphQLMapper,
];

const TRANSPORT_PROVIDERS = [...REST_PROVIDERS, ...GRAPHQL_PROVIDERS];

@Module({
  imports: [
    CqrsModule,
    TenancyModule,
    HttpModule,
    ConfigModule.forFeature(embeddingsConfig),
    TypeOrmModule.forFeature([
      EmbeddingTypeOrmEntity,
      ...EMBEDDING_VECTOR_ENTITIES_BY_DIMENSION.values(),
    ]),
    BullModule.registerQueue({ name: 'embeddings' }),
  ],
  controllers: [...REST_CONTROLLERS],
  providers: [
    ...COMMAND_HANDLERS,
    ...QUERY_HANDLERS,
    ...DOMAIN_SERVICES,
    ...DOMAIN_BUILDERS,
    ...INFRASTRUCTURE_MAPPERS,
    ...INFRASTRUCTURE_REPOSITORIES,
    ...INFRASTRUCTURE_PORTS,
    ...INFRASTRUCTURE_ADAPTERS,
    ...TRANSPORT_PROVIDERS,
  ],
  exports: [],
})
export class EmbeddingsModule {}
