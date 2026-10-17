import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Harus sebelum app.use pertama (router Express dibuat saat itu). 'simple' = ?a[b]=c tetap string, bukan objek
  // yang bisa menyelinap jadi operator filter Prisma (mis. ?source[not]=BCA).
  app.set('query parser', 'simple');
  app.set('trust proxy', 1); // di belakang Nginx: req.ip = IP klien asli (throttler login/split-bill per-IP)
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store'); // data keuangan: jangan disimpan cache browser/proxy (SSE/CSV menimpa sendiri)
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  // Body mentah (MIME) untuk HMAC /ingest/email — harus sebelum body parser JSON bawaan Nest.
  app.use('/ingest/email', express.raw({ type: () => true, limit: '3mb' }));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    maxAge: 7200, // preflight (POST/PUT JSON) di-cache browser 2 jam (batas Chrome), bukan diulang tiap request
  });

  const port = process.env.BACKEND_PORT || 4000;
  await app.listen(port);
  console.log(`Trackster backend running on port ${port}`);
}
bootstrap();
