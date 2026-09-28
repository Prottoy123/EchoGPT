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

  // OpenAPI (Swagger) Setup - Relying on CLI plugin for DTO reflection
  const config = new DocumentBuilder()
    .setTitle('EchoGPT REST API')
    .setDescription(
      'Production-ready RESTful API backend for EchoGPT Chrome Extension using NestJS, PostgreSQL & Vercel AI SDK',
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
    .addTag('Authentication', 'User registration, login, and token rotation')
    .addTag('User Profile & Usage', 'Profile details and remaining quota limits')
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
