/**
 * Rekening milik owner — transfer ke nomor ini = internal (bukan expense).
 * Cocokkan pakai digit-only supaya format "6611-126-589" / "6611126589" sama.
 */
const OWN_ACCOUNT_NUMBERS = (
  process.env.OWNER_ACCOUNT_NUMBERS ||
  // Default: BCA, Jago, Blu milik Arzaka (bisa dioverride via env, comma-separated)
  '6611126589,105602544330,006751400577'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const OWNER_FULL_NAME = (process.env.OWNER_FULL_NAME || 'ARZAKA RAFFAN MAWARDI').toUpperCase();

/** Normalisasi nomor rekening: buang spasi/strip, keep digits only. */
export function normalizeAccountNumber(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/\D/g, '');
}

/**
 * Exact match, suffix/prefix (min 6 digit), atau SoF mask gaya 6611xxxx89
 * (prefix+suffix sama, tengah ter-mask / hilang saat strip non-digit).
 */
function matchesOwnAccount(digits: string, own: string): boolean {
  if (!digits || !own) return false;
  if (digits === own) return true;

  // Hindari false positive dari potongan pendek ("89", "577")
  if (digits.length >= 6 && (digits.endsWith(own) || own.endsWith(digits))) return true;

  // Masked middle: e.g. "661189" dari "6611xxxx89" vs own "6611126589"
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

export function isOwnAccountNumber(raw: string | null | undefined): boolean {
  const digits = normalizeAccountNumber(raw);
  if (!digits) return false;
  return OWN_ACCOUNT_NUMBERS.some((own) => matchesOwnAccount(digits, normalizeAccountNumber(own)));
}

export function isOwnerName(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return raw.toUpperCase().includes(OWNER_FULL_NAME);
}

/**
 * Internal transfer kalau tujuan jelas rekening sendiri.
 * Prefer account number; fallback ke nama owner kalau nomor tidak ada di email.
 */
export function isInternalDestination(opts: {
  accountNumber?: string | null;
  beneficiaryName?: string | null;
}): boolean {
  if (isOwnAccountNumber(opts.accountNumber)) return true;
  // Nama saja rentan false positive — cuma dipakai kalau account number kosong
  if (!normalizeAccountNumber(opts.accountNumber) && isOwnerName(opts.beneficiaryName)) return true;
  return false;
}

export function ownAccountNumbersForLog(): string[] {
  return [...OWN_ACCOUNT_NUMBERS];
}
