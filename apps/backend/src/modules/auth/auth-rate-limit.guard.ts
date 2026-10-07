import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

const WINDOW_MS = 60_000;
const LIMIT = Number(process.env.AUTH_THROTTLE_LIMIT) || 10; // per IP per rute per menit (env hanya utk tes e2e)
// Sengaja BUKAN @nestjs/throttler: ThrottlerModule.forRoot di modul lain (split-bill: 5 per 10 mnt) ikut terbaca guard ini dan
// membatasi login dengan angka yang salah. ponytail: in-memory, satu proses backend.
const hits = new Map<string, { n: number; since: number }>();

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const key = `${req.ip}|${req.route?.path}`;
    const now = Date.now();
    const h = hits.get(key);
    if (!h || now - h.since >= WINDOW_MS) {
      if (hits.size > 5000) hits.clear(); // jaga memori
      hits.set(key, { n: 1, since: now });
      return true;
    }
    if (++h.n > LIMIT) throw new HttpException('Terlalu banyak percobaan. Coba lagi sebentar.', HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
