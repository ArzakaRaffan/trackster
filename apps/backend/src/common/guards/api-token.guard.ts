import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiTokenService } from '../../modules/api-token/api-token.service';
import { bearerToken } from '../../modules/api-token/api-token.util';

const WINDOW_MS = 60_000;
const LIMIT = Number(process.env.INGEST_RATE_LIMIT) || 60; // per token per menit (env hanya utk tes e2e)
const hits = new Map<number, { n: number; since: number }>(); // ponytail: in-memory, satu proses backend

/** Bearer `trk_…` → `request.apiAuth = { userId, tokenId }`. userId HANYA dari token, tak pernah dari body. */
@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private tokens: ApiTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const raw = bearerToken(req.headers?.authorization);
    const auth = raw ? await this.tokens.authenticate(raw) : null;
    if (!auth) throw new UnauthorizedException('Token tidak valid');

    const now = Date.now();
    const h = hits.get(auth.tokenId);
    if (!h || now - h.since >= WINDOW_MS) {
      if (hits.size > 5000) hits.clear();
      hits.set(auth.tokenId, { n: 1, since: now });
    } else if (++h.n > LIMIT) {
      throw new HttpException('Terlalu banyak permintaan. Coba lagi sebentar.', HttpStatus.TOO_MANY_REQUESTS);
    }
    req.apiAuth = auth;
    return true;
  }
}
