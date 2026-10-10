import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';

const CACHE_MS = Number(process.env.AUTH_CACHE_MS ?? 30_000); // env hanya untuk tes (scripts/auth-e2e.mjs)
// Cache status user (ACTIVE + tokenVersion) agar tiap request tak menyentuh DB. Satu proses backend → `invalidateAuthCache` langsung efektif;
// ponytail: bila backend di-scale >1 instance, jendela basi maksimal CACHE_MS.
const cache = new Map<number, { status: string; role: string; tv: number; at: number }>();
export const invalidateAuthCache = (userId?: number) => (userId === undefined ? cache.clear() : cache.delete(userId));

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.['trackster_jwt'];

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    // JWT lain yang ditandatangani JWT_SECRET (mis. `state` OAuth Gmail, ada `purpose`) bukan token sesi.
    if (payload.purpose !== undefined || !Number.isInteger(payload.sub)) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    let u = cache.get(payload.sub);
    if (!u || Date.now() - u.at > CACHE_MS) {
      const row = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { status: true, role: true, tokenVersion: true } });
      u = row ? { status: row.status, role: row.role, tv: row.tokenVersion, at: Date.now() } : undefined;
      if (u) cache.set(payload.sub, u);
      else cache.delete(payload.sub);
    }
    // Token lama tanpa `tv` dianggap tv=0 (masa transisi sebelum ada ganti-password/logout-all).
    if (!u || u.status !== 'ACTIVE' || (payload.tv ?? 0) !== u.tv) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    request['user'] = { ...payload, role: u.role };
    return true;
  }
}
