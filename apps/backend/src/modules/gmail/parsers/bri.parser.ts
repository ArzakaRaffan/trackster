import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { EmailParser, RawEmail, ParseResult, extractField, parseRupiah, parseEmailDate } from './parser.interface';
import { isInternalDestination, OwnerContext } from './own-accounts';

/**
 * BRImo (bankbri@bri.co.id). Format "Label: Value". Subject:
 * "Pemindahan Dana Sesama Rekening BRI" (transfer) & "Pembelian QRIS Berhasil".
 * ponytail: contoh QRIS dari user terpotong di label tujuan — dugaan "Tujuan"; kalau salah parse() return null (aman).
 */
@Injectable()
export class BriParser implements EmailParser {
  canHandle(email: RawEmail): boolean {
    const from = email.from.toLowerCase();
    return from.includes('bri.co.id') || from.includes('brimo');
  }

  parse(email: RawEmail, ctx: OwnerContext): ParseResult | null {
    const subject = email.subject.toLowerCase();
    const body = email.body;

    let description: string | null;
    let amountRaw: string | null;
    let accountNumber: string | null = null;
    if (subject.includes('qris')) {
      description = extractField(body, 'Tujuan', { exact: true });
      amountRaw = extractField(body, 'Total Transaksi', { exact: true });
    } else if (subject.includes('pemindahan dana') || subject.includes('transfer')) {
      description = extractField(body, 'Nama Tujuan', { exact: true });
      accountNumber = extractField(body, 'Nomor Tujuan', { exact: true });
      amountRaw = extractField(body, 'Total', { exact: true });
    } else {
      return null;
    }
    if (!description || !amountRaw) return null;

    const amount = parseRupiah(amountRaw);
    if (!amount) return null;

    const dt = body.match(/(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})[\s\S]{0,10}?(\d{1,2}:\d{2}(?::\d{2})?)/);
    const occurredAt = (dt && parseEmailDate(`${dt[1]} ${dt[2]}`)) || new Date(parseInt(email.internalDate, 10));

    const isSelf = isInternalDestination({ accountNumber, beneficiaryName: description }, ctx);
    return {
      amount,
      description,
      source: Source.BRI,
      occurredAt,
      excluded: isSelf,
      excludeReason: isSelf ? 'Transfer ke rekening sendiri (internal)' : undefined,
      balanceOnly: isSelf,
    };
  }
}
