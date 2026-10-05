import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { EmailParser, RawEmail, ParseResult, extractField, parseRupiah, parseEmailDate } from './parser.interface';
import { isInternalDestination } from './own-accounts';

/**
 * Livin' by Mandiri. Tiga subject: "Pembayaran Berhasil!" (QRIS), "Top-up Berhasil!",
 * "Transfer Online Berhasil!". Amount = "Total Transaksi" (nominal + biaya, uang yang benar-benar
 * keluar) kalau ada, kalau tidak "Nominal Transaksi" (QRIS tanpa biaya).
 */
@Injectable()
export class MandiriParser implements EmailParser {
  canHandle(email: RawEmail): boolean {
    const from = email.from.toLowerCase();
    return from.includes('mandiri') || from.includes('livin');
  }

  parse(email: RawEmail): ParseResult | null {
    const subject = email.subject.toLowerCase();
    const body = email.body;

    let description: string | null;
    let accountNumber: string | null = null;
    if (subject.includes('pembayaran berhasil')) {
      description = extractField(body, 'Penerima')?.replace(/\s+-\s+ID$/, '') ?? null;
    } else if (subject.includes('top-up berhasil')) {
      const provider = extractField(body, 'Penyedia Jasa');
      description = provider ? `Top-up ${provider}` : null;
    } else if (subject.includes('transfer online berhasil')) {
      description = extractField(body, 'Penerima');
      // Baris setelah nama: "Bank Jago - 101129332157"
      accountNumber = body.match(/Penerima[\s\S]{0,120}?-\s*(\d{6,})/i)?.[1] ?? null;
    } else {
      return null;
    }

    const nominal = body.match(/(?:Total Transaksi|Nominal Transaksi)\s*:?\s*(Rp\s?[\d.,]+)/i)?.[1];
    if (!description || !nominal) return null;

    // "Rp 7.900,00": koma = desimal — buang dulu, parseRupiah menganggap koma sebagai ribuan.
    const amount = parseRupiah(nominal.replace(/,\d{2}$/, ''));
    if (!amount) return null;

    const dt = body.match(/(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})[\s\S]{0,40}?(\d{1,2}:\d{2}(?::\d{2})?)/);
    const occurredAt = (dt && parseEmailDate(`${dt[1]} ${dt[2]}`)) || new Date(parseInt(email.internalDate, 10));

    const isSelf = isInternalDestination({ accountNumber, beneficiaryName: description });
    return {
      amount,
      description,
      source: Source.MANDIRI,
      occurredAt,
      excluded: isSelf,
      excludeReason: isSelf ? 'Transfer ke rekening sendiri (internal)' : undefined,
      balanceOnly: isSelf,
    };
  }
}
