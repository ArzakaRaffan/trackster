import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

// Endpoint yang memanggil AI berbayar (atau mengirim Telegram): dibatasi per user per rute, supaya satu akun tak bisa
// menghabiskan kuota/biaya AI semua orang. ponytail: in-memory, satu proses backend (reset saat restart);
// pindah ke tabel AiUsage bila butuh kuota persisten/lintas instance.
const PER_MIN = Number(process.env.AI_RATE_PER_MIN) || 20; // env hanya utk tes
const PER_DAY = Number(process.env.AI_RATE_PER_DAY) || 300;
const hits = new Map<string, { m: number; mSince: number; d: number; dSince: number }>();

/** true = boleh lanjut; false = kena batas. Dipakai guard di bawah dan webhook Telegram (chat AI lewat bot). */
export function aiQuotaOk(key: string, now = Date.now()): boolean {
  let h = hits.get(key);
  if (!h) {
    if (hits.size > 20_000) hits.clear();
    h = { m: 0, mSince: now, d: 0, dSince: now };
    hits.set(key, h);
  }
  if (now - h.mSince >= 60_000) (h.m = 0), (h.mSince = now);
  if (now - h.dSince >= 86_400_000) (h.d = 0), (h.dSince = now);
  if (h.m >= PER_MIN || h.d >= PER_DAY) return false;
  h.m++;
  h.d++;
  return true;
}

/** Pasang SETELAH JwtAuthGuard (butuh `req.user.sub`). */
@Injectable()
export class AiRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (!aiQuotaOk(`${req.user?.sub}|${req.method} ${req.route?.path}`)) {
      throw new HttpException('Batas pemakaian AI tercapai. Coba lagi nanti.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
