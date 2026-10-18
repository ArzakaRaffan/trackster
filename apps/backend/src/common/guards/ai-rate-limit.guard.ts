import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { wibDateKey } from '../wib';

// Endpoint yang memanggil AI berbayar (atau mengirim Telegram): dibatasi per user per rute, supaya satu akun tak bisa
// menghabiskan kuota/biaya AI semua orang. Batas harian per user di tabel AiUsage (bertahan saat deploy/restart);
// batas per menit & kuota per IP (scan struk anonim) in-memory — reset saat restart tak berarti banyak di sana.
const PER_MIN = Number(process.env.AI_RATE_PER_MIN) || 20; // env hanya utk tes
const PER_DAY = Number(process.env.AI_RATE_PER_DAY) || 300;
const hits = new Map<string, { m: number; mSince: number; d: number; dSince: number }>();

/** In-memory. true = boleh lanjut; false = kena batas. Dipakai langsung untuk kunci tanpa user (IP) & burst per menit. */
export function aiQuotaOk(key: string, now = Date.now(), perDay = PER_DAY): boolean {
  let h = hits.get(key);
  if (!h) {
    if (hits.size > 20_000) hits.clear();
    h = { m: 0, mSince: now, d: 0, dSince: now };
    hits.set(key, h);
  }
  if (now - h.mSince >= 60_000) (h.m = 0), (h.mSince = now);
  if (now - h.dSince >= 86_400_000) (h.d = 0), (h.dSince = now);
  if (h.m >= PER_MIN || h.d >= perDay) return false;
  h.m++;
  h.d++;
  return true;
}

/** Burst per menit (in-memory) + kuota harian per user per `kind` (AiUsage, hari WIB). Menghitung satu pemakaian. */
export async function aiUserQuotaOk(prisma: Pick<PrismaClient, 'aiUsage'>, userId: number, kind: string, perDay = PER_DAY): Promise<boolean> {
  if (!aiQuotaOk(`${userId}|${kind}`, Date.now(), Infinity)) return false;
  const dayKey = wibDateKey(new Date());
  const take = () =>
    prisma.aiUsage.upsert({
      where: { userId_dayKey_kind: { userId, dayKey, kind } },
      create: { userId, dayKey, kind, count: 1 },
      update: { count: { increment: 1 } },
    });
  // Dua request pertama hari itu bersamaan: yang kalah balapan create kena unik → ulangi sebagai update.
  const row = await take().catch((e) => (e?.code === 'P2002' ? take() : Promise.reject(e)));
  return row.count <= perDay;
}

/** Pasang SETELAH JwtAuthGuard (butuh `req.user.sub`). */
@Injectable()
export class AiRateLimitGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (!(await aiUserQuotaOk(this.prisma, req.user?.sub, `${req.method} ${req.route?.path}`))) {
      throw new HttpException('Batas pemakaian AI tercapai. Coba lagi nanti.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
