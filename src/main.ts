import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Swagger UI to render styles/scripts
    }),
  );

  // Response Compression
  app.use(compression());

  // CORS Configuration (supports Chrome Extensions & web clients)
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global API Prefix
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['docs', 'docs-json'],
  });

  // Global Request Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // OpenAPI (Swagger) Setup
  const config = new DocumentBuilder()
    .setTitle('EchoGPT REST API')
    .setDescription(
      'Production-grade RESTful API backend for the EchoGPT Chrome Extension. Features multi-AI provider orchestration (OpenAI, Claude, Gemini), real-time SSE streaming, AI-assisted web search, quota enforcement, and AES-256-GCM encrypted API key storage.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your Bearer Access Token',
        in: 'header',
      },
      'bearer',
    )
    .addTag('Authentication', 'User registration, login, token rotation, and email verification')
    .addTag('User Management', 'User profile, account settings, and password updates')
    .addTag('Subscription Management', 'Tier status, monthly limits, and upgrade/downgrade flows')
    .addTag('AI Provider Management', 'Multi-model registry, encrypted API vault, and health checks')
    .addTag('Chat Engine', 'Multi-provider prompt execution, thread history, and SSE streaming')
    .addTag('Web Search API', 'AI-assisted web query execution, search suggestions, and caching')
    .addTag('Admin Panel & Telemetry', 'System dashboard, user moderation, and audit logs')
    .addTag('System Health', 'Terminus health indicators for database and memory')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'EchoGPT API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`================================================================`);
  logger.log(` EchoGPT Backend is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(` Swagger Documentation:         http://localhost:${port}/docs`);
  logger.log(` System Health Endpoint:        http://localhost:${port}/${apiPrefix}/health`);
  logger.log(` Environment:                   ${process.env.NODE_ENV || 'development'}`);
  logger.log(`================================================================`);
}

bootstrap();
