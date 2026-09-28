import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  app.use(compression());

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['docs', 'docs-json'],
  });

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

  // OpenAPI (Swagger) Setup - Fully automated via @nestjs/swagger CLI plugin
  const config = new DocumentBuilder()
    .setTitle('EchoGPT REST API — Architecture & Engineering Specification')
    .setDescription(`
### 🚀 System Architecture Overview
**EchoGPT** is a production-grade backend engine engineered for high-concurrency browser extensions and web clients. Built with **NestJS**, **PostgreSQL**, and **Prisma ORM**, it provides unified multi-model AI routing, zero-exposure credential encryption, and real-time usage quotas.

---

### 🛡️ Core Architectural Pillars

#### 1. Security & Authentication Layer
* **Dual-Token JWT Lifecycle**: Issues short-lived access tokens (15m) paired with cryptographically rotated refresh tokens (7d).
* **Argon2id Password Hashing**: Utilizes memory-hard Argon2id to resist GPU/ASIC rainbow table attacks.
* **AES-256-GCM Key Vaulting**: Third-party AI provider API keys are stored in PostgreSQL strictly as compact \`iv:authTag:ciphertext\` payloads. Plaintext keys are decrypted only in ephemeral server memory during live model invocation and never logged or exposed via GET endpoints.
* **Role-Based Access Control (RBAC)**: Enforces role isolation between \`USER\` and \`ADMIN\` with declarative metadata guards.

#### 2. Multi-Model AI Routing Engine
* **Unified AI SDK Layer**: Leverages the Vercel AI SDK (\`ai\`, \`@ai-sdk/openai\`, \`@ai-sdk/google\`, \`@ai-sdk/anthropic\`) to eliminate provider lock-in and decouple model orchestration from extension clients.
* **Resilient Graceful Fallbacks**: Catches upstream outages, quota exhaustion, and rate limit errors cleanly without dropping client connections or crashing background workers.

#### 3. Quota Management & Monetization
* **Deterministic Request Metering**: Tracks request consumption per user with atomic database operations.
* **Hard Enforcement**: Rejects exhausted tier limits with HTTP 402 Payment Required while providing immediate upgrade paths.

#### 4. Live Web Search & Query Deduplication
* **AI-Assisted Search Pipeline**: DuckDuckGo instant answer engine paired with HTML fallback parsers.
* **Query Caching**: Automatically persists query payloads and search results to PostgreSQL for instant history retrieval and search autocomplete suggestions.

---

### 📈 Future Scalability & Production Roadmap
1. **Redis Caching Tier**: Move refresh token sessions and WebSearch caches into Redis clusters for sub-millisecond lookups at 100k+ concurrent users.
2. **Server-Sent Events (SSE) / WebSockets**: Transition AI chat generation from synchronous HTTP payloads to streaming chunked responses.
3. **BullMQ Worker Queues**: Decouple heavy web search scraping and API audit logging to background asynchronous worker pools.
4. **Vector Embeddings & Semantic Search**: Introduce \`pgvector\` in PostgreSQL for semantic RAG over historical chat conversations.
    `)
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Provide your Bearer Access Token (issued from /auth/login or /auth/register)',
        in: 'header',
      },
      'JWT',
    )
    .addTag('Authentication', 'Dual-token JWT lifecycle, Argon2 hashing, rotation, and logout')
    .addTag('User Profile & Usage', 'Account details, quota consumption tracking, password rotation, plan changes')
    .addTag('AI Providers', 'Admin-restricted AES-256-GCM encrypted provider management and health diagnostics')
    .addTag('Chat', 'Multi-model AI conversation routing, context memory, and thread persistence')
    .addTag('Web Search', 'Real-time search scraping, query history, deduplication, and autocomplete suggestions')
    .addTag('Admin Panel', 'Aggregated platform metrics, user controls, subscription overrides, analytics, and diagnostics')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'EchoGPT API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`================================================================`);
  logger.log(` EchoGPT Backend is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(` Swagger Documentation:         http://localhost:${port}/docs/`);
  logger.log(`================================================================`);
}

bootstrap();
