import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Agent, setGlobalDispatcher } from 'undici';
import { AppModule, ObserveInstrument } from './app.module.js';

// Long-idle pooled sockets from AI providers (Mistral/Sarvam) die on their side;
// evict them fast so reused sockets are always fresh.
setGlobalDispatcher(
  new Agent({
    keepAliveTimeout: 1_000,
    keepAliveMaxTimeout: 2_000,
    connect: { timeout: 15_000 },
  }),
);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger / OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle('JanSetu API')
    .setDescription(
      'Backend API for JanSetu — citizen services including policy Q&A, grievance triage, browser automation, and fact-checking.',
    )
    .setVersion('1.0')
    .addTag('app')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
