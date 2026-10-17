import type { NextFunction, Request, Response } from 'express';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Lapisan CSRF kedua (di atas SameSite=Lax + body JSON): request pengubah data yang membawa cookie sesi wajib datang
 * dari origin frontend. SameSite tidak melindungi dari subdomain lain *.trackster.dev (masih "same-site").
 * Browser selalu mengirim `Origin` pada POST/PUT/PATCH/DELETE; klien non-browser (Shortcut, Telegram, Worker)
 * tidak membawa cookie sesi, jadi tidak terdampak.
 */
export function isCsrfBlocked(method: string, hasSessionCookie: boolean, origin: string | undefined, allowed: string): boolean {
  if (SAFE.has(method.toUpperCase()) || !hasSessionCookie) return false;
  if (origin === undefined) return false; // bukan browser (atau browser sangat lama) — cookie Lax sudah menahan cross-site
  return origin !== allowed;
}

export function csrfOriginGuard(frontendUrl: string) {
  const allowed = new URL(frontendUrl).origin;
  return (req: Request, res: Response, next: NextFunction) => {
    const hasCookie = typeof req.headers.cookie === 'string' && req.headers.cookie.includes('trackster_jwt=');
    if (isCsrfBlocked(req.method, hasCookie, req.headers.origin, allowed)) {
      res.status(403).json({ statusCode: 403, message: 'Origin tidak diizinkan' });
      return;
    }
    next();
  };
}
