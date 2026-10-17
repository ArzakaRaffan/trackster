import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Ukuran pool eksplisit: app membuka ±30 request paralel saat dimuat, default Prisma (2×CPU+1 ≈ 5 di VPS 2 vCPU) membuat
 * antrean. 10 koneksi = jauh di bawah max_connections Postgres (100) & hemat RAM. DATABASE_URL yang sudah punya
 * `connection_limit` tidak diubah (bisa di-tuning dari .env). */
export function withPoolDefaults(url: string | undefined, limit = 10): string | undefined {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${limit}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = withPoolDefaults(process.env.DATABASE_URL);
    super(url ? { datasources: { db: { url } } } : undefined);
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
