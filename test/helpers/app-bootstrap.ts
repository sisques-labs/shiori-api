import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../../src/app.module';
import { BaseExceptionFilter } from '../../src/core/filters/base-exception.filter';
import { bootstrapTestDataSource } from './test-data-source';

export interface E2EContext {
  app: INestApplication;
  http: () => ReturnType<typeof request>;
  dataSource: DataSource;
  close: () => Promise<void>;
}

export interface E2EProviderOverride {
  provide: unknown;
  useValue: unknown;
}

export interface CreateE2EAppOptions {
  /**
   * DI tokens to swap for a test double before the module compiles — e.g.
   * a bounded context's outbound HTTP port that would otherwise make a real
   * network call (see `retrieval`'s `EMBEDDING_PORT`, stubbed in its e2e
   * specs since there is no real/mocked embeddings endpoint reachable in
   * CI). Omit entirely for specs that don't need it — existing callers are
   * unaffected.
   */
  overrideProviders?: E2EProviderOverride[];
}

export async function createE2EApp(
  options: CreateE2EAppOptions = {},
): Promise<E2EContext> {
  await bootstrapTestDataSource();

  const builder = Test.createTestingModule({
    imports: [AppModule],
  });

  for (const override of options.overrideProviders ?? []) {
    builder.overrideProvider(override.provide).useValue(override.useValue);
  }

  const moduleFixture = await builder.compile();

  const app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new BaseExceptionFilter());

  await app.init();

  const dataSource = moduleFixture.get<DataSource>(getDataSourceToken());

  return {
    app,
    http: () => request(app.getHttpServer()),
    dataSource,
    close: async () => {
      await app.close();
    },
  };
}
