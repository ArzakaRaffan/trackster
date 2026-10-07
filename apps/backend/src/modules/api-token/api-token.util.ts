import { createHash, randomInt } from 'crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const TOKEN_PREFIX = 'trk_';
const TOKEN_BODY_LEN = 40; // 62^40 ≈ 2^238

/** `trk_` + 40 karakter base62 (randomInt = CSPRNG, tanpa modulo bias). */
export function generateToken(): string {
  let s = TOKEN_PREFIX;
  for (let i = 0; i < TOKEN_BODY_LEN; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

export const isTokenShaped = (raw: string) => /^trk_[0-9A-Za-z]{32,64}$/.test(raw);

/** Ambil token dari header `Authorization: Bearer ...` saja (bukan query/body — masuk log Nginx). */
export function bearerToken(header: string | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return m ? m[1] : null;
}

/** Idempotency-Key: 8–100 karakter aman (UUID cocok). */
export const isValidIdempotencyKey = (k: unknown): k is string => typeof k === 'string' && /^[A-Za-z0-9._:-]{8,100}$/.test(k);
