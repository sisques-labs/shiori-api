import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TenancyModule } from '@core/tenancy/tenancy.module';

import { CreateKnowledgeBaseCommandHandler } from './application/commands/create-knowledge-base/create-knowledge-base.handler';
import { DeleteKnowledgeBaseCommandHandler } from './application/commands/delete-knowledge-base/delete-knowledge-base.handler';
import { RotateKnowledgeBaseApiKeyCommandHandler } from './application/commands/rotate-knowledge-base-api-key/rotate-knowledge-base-api-key.handler';
import { UpdateKnowledgeBaseCommandHandler } from './application/commands/update-knowledge-base/update-knowledge-base.handler';
import { KnowledgeBaseFindByApiKeyHashQueryHandler } from './application/queries/knowledge-base-find-by-api-key-hash/knowledge-base-find-by-api-key-hash.handler';
import { KnowledgeBaseFindByIdQueryHandler } from './application/queries/knowledge-base-find-by-id/knowledge-base-find-by-id.handler';
import { AssertKnowledgeBaseViewModelExistsService } from './application/services/read/assert-knowledge-base-view-model-exists/assert-knowledge-base-view-model-exists.service';
import { GenerateApiKeyService } from './application/services/write/generate-api-key/generate-api-key.service';
import { AssertKnowledgeBaseExistsService } from './application/services/write/assert-knowledge-base-exists/assert-knowledge-base-exists.service';
import { KnowledgeBaseBuilder } from './domain/builders/knowledge-base.builder';
import { KNOWLEDGE_BASE_READ_REPOSITORY } from './domain/repositories/read/knowledge-base-read.repository';
import { KNOWLEDGE_BASE_WRITE_REPOSITORY } from './domain/repositories/write/knowledge-base-write.repository';
import { KnowledgeBaseTypeOrmEntity } from './infrastructure/persistence/typeorm/entities/knowledge-base.entity';
import { KnowledgeBaseTypeOrmMapper } from './infrastructure/persistence/typeorm/mappers/knowledge-base-typeorm.mapper';
import { KnowledgeBaseTypeOrmReadRepository } from './infrastructure/persistence/typeorm/repositories/knowledge-base-typeorm-read.repository';
import { KnowledgeBaseTypeOrmWriteRepository } from './infrastructure/persistence/typeorm/repositories/knowledge-base-typeorm-write.repository';
import { KnowledgeBaseGraphQLMapper } from './transport/graphql/mappers/knowledge-base/knowledge-base.mapper';
import { KnowledgeBaseMutationsResolver } from './transport/graphql/resolvers/knowledge-base-mutations.resolver';
import { KnowledgeBaseQueriesResolver } from './transport/graphql/resolvers/knowledge-base-queries.resolver';
import { KnowledgeBaseRestMapper } from './transport/rest/mappers/knowledge-base/knowledge-base.mapper';
import { KnowledgeBasesController } from './transport/rest/controllers/knowledge-bases.controller';

const COMMAND_HANDLERS = [
  CreateKnowledgeBaseCommandHandler,
  UpdateKnowledgeBaseCommandHandler,
  DeleteKnowledgeBaseCommandHandler,
  RotateKnowledgeBaseApiKeyCommandHandler,
];

const QUERY_HANDLERS = [
  KnowledgeBaseFindByIdQueryHandler,
  KnowledgeBaseFindByApiKeyHashQueryHandler,
];

// HashApiKeyService comes from TenancyModule (imported below) — shared with
// KnowledgeBaseApiKeyGuard, not re-declared here.
const APPLICATION_SERVICES = [
  GenerateApiKeyService,
  AssertKnowledgeBaseExistsService,
  AssertKnowledgeBaseViewModelExistsService,
];

const DOMAIN_BUILDERS = [KnowledgeBaseBuilder];

const INFRASTRUCTURE_MAPPERS = [KnowledgeBaseTypeOrmMapper];

const INFRASTRUCTURE_REPOSITORIES = [
  {
    provide: KNOWLEDGE_BASE_WRITE_REPOSITORY,
    useClass: KnowledgeBaseTypeOrmWriteRepository,
  },
  {
    provide: KNOWLEDGE_BASE_READ_REPOSITORY,
    useClass: KnowledgeBaseTypeOrmReadRepository,
  },
];

const REST_CONTROLLERS = [KnowledgeBasesController];
const REST_PROVIDERS = [KnowledgeBaseRestMapper];
const GRAPHQL_PROVIDERS = [
  KnowledgeBaseMutationsResolver,
  KnowledgeBaseQueriesResolver,
  KnowledgeBaseGraphQLMapper,
];

// KnowledgeBaseApiKeyGuard is provided by TenancyModule (imported below) —
// every context that imports TenancyModule can @UseGuards() it without
// re-declaring it.
const TRANSPORT_PROVIDERS = [...REST_PROVIDERS, ...GRAPHQL_PROVIDERS];

@Module({
  imports: [
    CqrsModule,
    TenancyModule,
    TypeOrmModule.forFeature([KnowledgeBaseTypeOrmEntity]),
  ],
  controllers: [...REST_CONTROLLERS],
  providers: [
    ...COMMAND_HANDLERS,
    ...QUERY_HANDLERS,
    ...APPLICATION_SERVICES,
    ...DOMAIN_BUILDERS,
    ...INFRASTRUCTURE_MAPPERS,
    ...INFRASTRUCTURE_REPOSITORIES,
    ...TRANSPORT_PROVIDERS,
  ],
})
export class KnowledgeBasesModule {}
