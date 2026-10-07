import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { EmailParser, RawEmail, ParseResult, extractField, parseRupiah, parseEmailDate } from './parser.interface';
import { isInternalDestination, OwnerContext } from './own-accounts';

/** wondr by BNI — "Transaksi Berhasil!" (QRIS dll). Penerima = baris pertama setelah label "Penerima". */
@Injectable()
export class BniParser implements EmailParser {
  canHandle(email: RawEmail): boolean {
    return email.from.toLowerCase().includes('bni');
  }

  parse(email: RawEmail, ctx: OwnerContext): ParseResult | null {
    if (!/transaksi berhasil/i.test(email.subject)) return null;

    const body = email.body;
    const penerima = extractField(body, 'Penerima');
    const nominal = body.match(/Nominal\s*:?\s*(Rp\s?[\d.,]+)/i)?.[1];
    if (!penerima || !nominal) return null;

    const amount = parseRupiah(nominal);
    if (!amount) return null;

    // Tanggal & waktu bisa terpisah baris atau satu baris tab — regex nangkap dua-duanya.
    const dt = body.match(/(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})[\s\S]{0,40}?(\d{1,2}:\d{2}(?::\d{2})?)/);
    const occurredAt = (dt && parseEmailDate(`${dt[1]} ${dt[2]}`)) || new Date(parseInt(email.internalDate, 10));

    const isSelf = isInternalDestination({ accountNumber: null, beneficiaryName: penerima }, ctx);
    return {
      amount,
      description: penerima,
      source: Source.BNI,
      occurredAt,
      excluded: isSelf,
      excludeReason: isSelf ? 'Transfer ke rekening sendiri (internal)' : undefined,
      balanceOnly: isSelf,
    };
  }
}
