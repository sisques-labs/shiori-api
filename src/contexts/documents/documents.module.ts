import './transport/graphql/enums/documents-registered-enums.graphql';

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TenancyModule } from '@core/tenancy/tenancy.module';

import { CreateDocumentCommandHandler } from './application/commands/create-document/create-document.handler';
import { DeleteDocumentCommandHandler } from './application/commands/delete-document/delete-document.handler';
import { DeleteDocumentsByKnowledgeBaseCommandHandler } from './application/commands/delete-documents-by-knowledge-base/delete-documents-by-knowledge-base.handler';
import { UpdateDocumentCommandHandler } from './application/commands/update-document/update-document.handler';
import { CHUNKING_STRATEGY_PORT } from './application/ports/chunking-strategy.port';
import { DOCUMENT_BATCH_FINDER_PORT } from './application/ports/document-batch-finder.port';
import { DOCUMENT_PROCESSING_QUEUE_PORT } from './application/ports/document-processing-queue.port';
import { DocumentFindBatchQueryHandler } from './application/queries/document-find-batch/document-find-batch.handler';
import { DocumentFindByCriteriaQueryHandler } from './application/queries/document-find-by-criteria/document-find-by-criteria.handler';
import { DocumentFindByIdQueryHandler } from './application/queries/document-find-by-id/document-find-by-id.handler';
import { AssertDocumentViewModelExistsService } from './application/services/read/assert-document-view-model-exists/assert-document-view-model-exists.service';
import { AssertDocumentContentNotTooLargeService } from './application/services/write/assert-document-content-not-too-large/assert-document-content-not-too-large.service';
import { AssertDocumentExistsService } from './application/services/write/assert-document-exists/assert-document-exists.service';
import { DeleteDocumentsByKnowledgeBaseService } from './application/services/write/delete-documents-by-knowledge-base/delete-documents-by-knowledge-base.service';
import { ChunkBuilder } from './domain/builders/chunk.builder';
import { DocumentBuilder } from './domain/builders/document.builder';
import { CHUNK_WRITE_REPOSITORY } from './domain/repositories/write/chunk-write.repository';
import { DOCUMENT_READ_REPOSITORY } from './domain/repositories/read/document-read.repository';
import { DOCUMENT_WRITE_REPOSITORY } from './domain/repositories/write/document-write.repository';
import { DocumentBatchFinderAdapter } from './infrastructure/adapters/document-batch-finder.adapter';
import { KnowledgeBaseDeletedListener } from './infrastructure/adapters/knowledge-base-deleted.listener';
import { documentsConfig } from './infrastructure/config/documents.config';
import { ChunkTypeOrmEntity } from './infrastructure/persistence/typeorm/entities/chunk.entity';
import { DocumentTypeOrmEntity } from './infrastructure/persistence/typeorm/entities/document.entity';
import { ChunkTypeOrmMapper } from './infrastructure/persistence/typeorm/mappers/chunk-typeorm.mapper';
import { DocumentTypeOrmMapper } from './infrastructure/persistence/typeorm/mappers/document-typeorm.mapper';
import { ChunkTypeOrmWriteRepository } from './infrastructure/persistence/typeorm/repositories/chunk-typeorm-write.repository';
import { DocumentTypeOrmReadRepository } from './infrastructure/persistence/typeorm/repositories/document-typeorm-read.repository';
import { DocumentTypeOrmWriteRepository } from './infrastructure/persistence/typeorm/repositories/document-typeorm-write.repository';
import { ChunkDocumentProcessor } from './infrastructure/processors/chunk-document.processor';
import { BullmqDocumentProcessingQueueService } from './infrastructure/services/bullmq-document-processing-queue.service';
import { RecursiveChunkingService } from './infrastructure/services/recursive-chunking.service';
import { DocumentGraphQLMapper } from './transport/graphql/mappers/document/document.mapper';
import { DocumentMutationsResolver } from './transport/graphql/resolvers/document-mutations.resolver';
import { DocumentQueriesResolver } from './transport/graphql/resolvers/document-queries.resolver';
import { DocumentCreateMcpTool } from './transport/mcp/tools/document-create.tool';
import { DocumentDeleteMcpTool } from './transport/mcp/tools/document-delete.tool';
import { DocumentFindByCriteriaMcpTool } from './transport/mcp/tools/document-find-by-criteria.tool';
import { DocumentFindByIdMcpTool } from './transport/mcp/tools/document-find-by-id.tool';
import { DocumentsController } from './transport/rest/controllers/documents.controller';
import { DocumentRestMapper } from './transport/rest/mappers/document/document.mapper';

const COMMAND_HANDLERS = [
  CreateDocumentCommandHandler,
  UpdateDocumentCommandHandler,
  DeleteDocumentCommandHandler,
  DeleteDocumentsByKnowledgeBaseCommandHandler,
];

const QUERY_HANDLERS = [
  DocumentFindByIdQueryHandler,
  DocumentFindByCriteriaQueryHandler,
  DocumentFindBatchQueryHandler,
];

const APPLICATION_SERVICES = [
  AssertDocumentExistsService,
  AssertDocumentViewModelExistsService,
  AssertDocumentContentNotTooLargeService,
  DeleteDocumentsByKnowledgeBaseService,
];

const DOMAIN_BUILDERS = [DocumentBuilder, ChunkBuilder];

const INFRASTRUCTURE_MAPPERS = [DocumentTypeOrmMapper, ChunkTypeOrmMapper];

const INFRASTRUCTURE_REPOSITORIES = [
  {
    provide: DOCUMENT_WRITE_REPOSITORY,
    useClass: DocumentTypeOrmWriteRepository,
  },
  {
    provide: DOCUMENT_READ_REPOSITORY,
    useClass: DocumentTypeOrmReadRepository,
  },
  {
    provide: CHUNK_WRITE_REPOSITORY,
    useClass: ChunkTypeOrmWriteRepository,
  },
];

const INFRASTRUCTURE_PORTS = [
  { provide: CHUNKING_STRATEGY_PORT, useClass: RecursiveChunkingService },
  {
    provide: DOCUMENT_PROCESSING_QUEUE_PORT,
    useClass: BullmqDocumentProcessingQueueService,
  },
  {
    provide: DOCUMENT_BATCH_FINDER_PORT,
    useClass: DocumentBatchFinderAdapter,
  },
];

// ChunkDocumentProcessor is discovered by BullMQ via its own @Processor()
// decorator, not by anything in this array — it's still declared as a
// regular provider so Nest's DI container can construct it.
const INFRASTRUCTURE_ADAPTERS = [
  KnowledgeBaseDeletedListener,
  ChunkDocumentProcessor,
];

const REST_CONTROLLERS = [DocumentsController];
const REST_PROVIDERS = [DocumentRestMapper];
const GRAPHQL_PROVIDERS = [
  DocumentMutationsResolver,
  DocumentQueriesResolver,
  DocumentGraphQLMapper,
];
const MCP_TOOLS = [
  DocumentCreateMcpTool,
  DocumentFindByIdMcpTool,
  DocumentFindByCriteriaMcpTool,
  DocumentDeleteMcpTool,
];

const TRANSPORT_PROVIDERS = [
  ...REST_PROVIDERS,
  ...GRAPHQL_PROVIDERS,
  ...MCP_TOOLS,
];

@Module({
  imports: [
    CqrsModule,
    TenancyModule,
    ConfigModule.forFeature(documentsConfig),
    TypeOrmModule.forFeature([DocumentTypeOrmEntity, ChunkTypeOrmEntity]),
    BullModule.registerQueue({ name: 'documents' }),
  ],
  controllers: [...REST_CONTROLLERS],
  providers: [
    ...COMMAND_HANDLERS,
    ...QUERY_HANDLERS,
    ...APPLICATION_SERVICES,
    ...DOMAIN_BUILDERS,
    ...INFRASTRUCTURE_MAPPERS,
    ...INFRASTRUCTURE_REPOSITORIES,
    ...INFRASTRUCTURE_PORTS,
    ...INFRASTRUCTURE_ADAPTERS,
    ...TRANSPORT_PROVIDERS,
  ],
})
export class DocumentsModule {}
