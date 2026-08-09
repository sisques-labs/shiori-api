import './telemetry';

import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  VersioningType,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { VERSION_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { McpController } from '@sisques-labs/nestjs-kit/mcp';

import { AppModule } from './app.module';
import { BaseExceptionFilter } from './core/filters/base-exception.filter';

// This controller ships inside @sisques-labs/nestjs-kit without a version,
// so URI versioning below would otherwise move it to /api/v1/*. MCP client
// configs expect the stable, unversioned path, so pin it here.
Reflect.defineMetadata(VERSION_METADATA, VERSION_NEUTRAL, McpController);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new BaseExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Shiori API')
    .setDescription('Shiori — open-source RAG platform')
    .setVersion('0.0.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'x-api-key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const corsOrigins = app
    .get(ConfigService)
    .getOrThrow<string[]>('app.corsOrigins');
  app.enableCors({ origin: corsOrigins, credentials: true });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Listening on http://localhost:${port}/api/v1`);
  console.log(`Swagger docs at http://localhost:${port}/docs`);
}
bootstrap().catch((error: unknown) => {
  console.error('Failed to start the application', error);
  process.exit(1);
});
