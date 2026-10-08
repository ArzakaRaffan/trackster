import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1); // di belakang Nginx: req.ip = IP klien asli (throttler login/split-bill per-IP)

  // Body mentah (MIME) untuk HMAC /ingest/email — harus sebelum body parser JSON bawaan Nest.
  app.use('/ingest/email', express.raw({ type: () => true, limit: '3mb' }));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.BACKEND_PORT || 4000;
  await app.listen(port);
  console.log(`Trackster backend running on port ${port}`);
}
bootstrap();
