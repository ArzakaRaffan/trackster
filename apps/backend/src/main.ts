import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { csrfOriginGuard } from './common/csrf';

async function bootstrap() {
  // Tanpa secret, jsonwebtoken menolak semua token (aman tapi app mati) — gagal jelas di awal. Secret pendek = cookie sesi
  // bisa di-brute-force offline; diperingatkan saja (bukan crash) supaya deploy tidak menjatuhkan prod.
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET belum di-set');
  if (process.env.JWT_SECRET.length < 32) console.warn('[security] JWT_SECRET < 32 karakter — ganti dengan `openssl rand -base64 48`');

  // bodyParser bawaan Nest dimatikan: dipasang manual di bawah (batas per rute, tanpa form-urlencoded untuk rute cookie).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // Harus sebelum app.use pertama (router Express dibuat saat itu). 'simple' = ?a[b]=c tetap string, bukan objek
  // yang bisa menyelinap jadi operator filter Prisma (mis. ?source[not]=BCA).
  app.set('query parser', 'simple');
  app.set('trust proxy', 1); // di belakang Nginx: req.ip = IP klien asli (throttler login/split-bill per-IP)
  app.disable('x-powered-by');
  app.disable('etag'); // respons API no-store; ETag cuma menambah hash body tiap request

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'"); // API hanya JSON/ICS/CSV
    res.setHeader('Cache-Control', 'no-store'); // data keuangan: jangan disimpan cache browser/proxy (SSE/CSV menimpa sendiri)
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.use(csrfOriginGuard(process.env.FRONTEND_URL || 'http://localhost:3000'));

  // Body mentah (MIME) untuk HMAC /ingest/email — harus sebelum body parser JSON.
  app.use('/ingest/email', express.raw({ type: () => true, limit: '3mb' }));
  // Foto struk (data URL base64, sudah dikecilkan di browser) — satu-satunya rute JSON besar.
  app.use('/split-bills/scan-receipt', express.json({ limit: '6mb' }));
  app.use(express.json({ limit: '200kb' }));
  // Form hanya untuk Shortcut/HTTP client ber-token (Bearer, bukan cookie) — rute cookie tak menerima form (lapisan CSRF).
  app.use('/ingest', express.urlencoded({ extended: false, limit: '20kb' }));
  // Error body-parser (JSON rusak / terlalu besar) = kesalahan klien: jawab ringkas tanpa stack trace di log (cegah banjir log).
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ statusCode: 413, message: 'Body terlalu besar' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ statusCode: 400, message: 'JSON tidak valid' });
    next(err);
  });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    maxAge: 7200, // preflight (POST/PUT JSON) di-cache browser 2 jam (batas Chrome), bukan diulang tiap request
  });
  app.enableShutdownHooks(); // SIGTERM (docker stop/deploy) → Prisma disconnect rapi, request berjalan tidak diputus kasar

  const port = process.env.BACKEND_PORT || 4000;
  const server = await app.listen(port);
  // Nginx memakai koneksi keepalive ke upstream; timeout Node harus > timeout idle nginx supaya tak ada 502 acak.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  console.log(`Trackster backend running on port ${port}`);
}
bootstrap();
