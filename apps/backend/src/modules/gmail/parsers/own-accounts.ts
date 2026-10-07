/**
 * Konteks pemilik (per user): nama di rekening bank + nomor rekening miliknya. Transfer ke nomor/nama ini = internal.
 * Cocokkan pakai digit-only supaya format "1234-567-890" / "1234567890" sama. Konteks kosong = tidak ada yang dianggap milik sendiri.
 */
export interface OwnerContext {
  fullName: string;
  accounts: string[];
}

/** Normalisasi nomor rekening: buang spasi/strip, keep digits only. */
export function normalizeAccountNumber(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/\D/g, '');
}

/**
 * Exact match, suffix/prefix (min 6 digit), atau SoF mask gaya 1234xxxx90
 * (prefix+suffix sama, tengah ter-mask / hilang saat strip non-digit).
 */
function matchesOwnAccount(digits: string, own: string): boolean {
  if (!digits || !own) return false;
  if (digits === own) return true;

  // Hindari false positive dari potongan pendek ("89", "577")
  if (digits.length >= 6 && (digits.endsWith(own) || own.endsWith(digits))) return true;

  // Masked middle: e.g. "123490" dari "1234xxxx90" vs own "1234567890"
  if (digits.length >= 6 && digits.length < own.length) {
    for (let prefixLen = 4; prefixLen <= digits.length - 2; prefixLen++) {
      const suffixLen = digits.length - prefixLen;
      if (suffixLen < 2) continue;
      if (
        own.startsWith(digits.slice(0, prefixLen)) &&
        own.endsWith(digits.slice(-suffixLen))
      ) {
        return true;
      }
    }
  }

  return false;
}

export function isOwnAccountNumber(raw: string | null | undefined, ctx: OwnerContext): boolean {
  const digits = normalizeAccountNumber(raw);
  if (!digits) return false;
  return ctx.accounts.some((own) => matchesOwnAccount(digits, normalizeAccountNumber(own)));
}

export function isOwnerName(raw: string | null | undefined, ctx: OwnerContext): boolean {
  const ownerName = ctx.fullName.trim().toUpperCase();
  // Nama kosong (env belum di-set) jangan dianggap cocok: ''.includes('') selalu true
  if (!raw || !ownerName) return false;
  return raw.toUpperCase().includes(ownerName);
}

/**
 * Internal transfer kalau tujuan jelas rekening sendiri.
 * Prefer account number; fallback ke nama owner kalau nomor tidak ada di email.
 */
export function isInternalDestination(
  opts: { accountNumber?: string | null; beneficiaryName?: string | null },
  ctx: OwnerContext,
): boolean {
  if (isOwnAccountNumber(opts.accountNumber, ctx)) return true;
  // Nama saja rentan false positive — cuma dipakai kalau account number kosong
  if (!normalizeAccountNumber(opts.accountNumber) && isOwnerName(opts.beneficiaryName, ctx)) return true;
  return false;
}
