import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Satu PrismaClient (= satu connection pool) untuk seluruh app. Dulu tiap module mendaftarkan PrismaService sendiri →
 * ±25 client & pool terpisah (bisa melewati max_connections Postgres, boros RAM di VPS 2GB). Jangan daftarkan ulang di module lain. */
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
