import { appConfig } from './config/app.config';
import { validateEnv } from './config/env.validation';
import { kafkaConfig } from './config/kafka.config';
import { postgresConfig } from './config/postgres.config';
import { redisConfig, RedisConfig } from './config/redis.config';
import { sentryConfig } from './config/sentry.config';
import { AGGREGATE_MODULE_MAP } from './messaging/domain/topics/aggregate-module.map.generated';
import { HealthModule } from './health/health.module';
import { McpContextBuilder } from './mcp/mcp-context.builder';
import { ObservabilityModule } from './observability/observability.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { PingResolver } from './transport/graphql/resolvers/ping.resolver';
import './transport/graphql/registered-enums.graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SharedGraphQLModule } from '@sisques-labs/nestjs-kit/graphql';
import { McpModule } from '@sisques-labs/nestjs-kit/mcp';
import { MessagingModule } from '@sisques-labs/nestjs-kit/messaging';
import { MetricsModule } from '@sisques-labs/nestjs-kit/metrics';

import { SupportModule } from '../support/support.module';

// Cross-cutting infrastructure every bounded context relies on: config, DB,
// transports, observability. Add new app-wide wiring here, not in AppModule.
const CORE_MODULES = [
  SupportModule,
  CqrsModule.forRoot(),
  SharedGraphQLModule,
  TenancyModule,
  ConfigModule.forRoot({
    isGlobal: true,
    validate: validateEnv,
    load: [postgresConfig, appConfig, sentryConfig, kafkaConfig, redisConfig],
    cache: true,
  }),
  TypeOrmModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) =>
      config.getOrThrow<TypeOrmModuleOptions>('postgres'),
  }),
  // Redis-backed job queues for async context pipelines (e.g. documents'
  // chunking job). One shared connection; each context registers its own
  // named queue via BullModule.registerQueue({ name }) in its own module.
  BullModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      connection: config.getOrThrow<RedisConfig>('redis'),
    }),
  }),
  // REST controllers are documented via Swagger (see main.ts). GraphQL is
  // wired alongside it — drop whichever transport this service doesn't use.
  GraphQLModule.forRoot<ApolloDriverConfig>({
    driver: ApolloDriver,
    autoSchemaFile: true,
    playground: true,
    context: ({ req, res }: { req: Request; res: Response }) => ({
      req,
      res,
    }),
  }),
  ObservabilityModule,
  MetricsModule.forRoot({ appLabel: 'shiori-api' }),
  MessagingModule.forRoot({ aggregateModuleMap: AGGREGATE_MODULE_MAP }),
  HealthModule,
  McpModule.forRoot({
    name: 'shiori-api',
    version: '0.1.0',
    contextBuilder: McpContextBuilder,
  }),
];

@Module({
  imports: [...CORE_MODULES],
  providers: [PingResolver],
})
export class CoreModule {}
