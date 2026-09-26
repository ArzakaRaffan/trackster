import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { EmailParser, RawEmail, ParseResult, extractField, parseRupiah, parseEmailDate } from './parser.interface';
import { isInternalDestination } from './own-accounts';

const JAGO_SENDER_HINTS = ['jago'];

@Injectable()
export class JagoParser implements EmailParser {
  canHandle(email: RawEmail): boolean {
    const from = email.from.toLowerCase();
    return JAGO_SENDER_HINTS.some((hint) => from.includes(hint));
  }

  parse(email: RawEmail): ParseResult | null {
    const subject = email.subject.toLowerCase();
    const body = email.body;

    if (subject.includes('menerima sejumlah uang') || body.includes('telah menerima sejumlah uang')) {
      return this.parseIncoming(body, email);
    }

    if (subject.includes('melakukan transfer') || body.includes('melakukan transfer uang')) {
      return this.parseTransfer(body, email);
    }

    if (subject.includes('membayar ke') || body.includes('mengirimkan uang')) {
      return this.parseQrisPayment(body, email);
    }

    return null;
  }

  /**
   * "Asik, kamu telah menerima sejumlah uang" — dana masuk ke Kantong Jago. `description` = nama
   * pengirim mentah (dipakai IncomeService buat klasifikasi CONFIRMED/INTERNAL/PENDING via
   * matchKeywords/OWNER_FULL_NAME/korelasi FLIPTECH — bukan urusan parser ini).
   */
  private parseIncoming(body: string, email: RawEmail): ParseResult | null {
    const jumlahRaw = extractField(body, 'Jumlah');
    const dari = extractField(body, 'Dari');
    const tanggalRaw = extractField(body, 'Tanggal transaksi') || extractField(body, 'Tanggal Transaksi');

    if (!jumlahRaw || !dari) return null;

    const amount = parseRupiah(jumlahRaw);
    if (!amount || amount <= 0) return null;

    const occurredAt = (tanggalRaw && parseEmailDate(tanggalRaw)) || new Date(parseInt(email.internalDate, 10));

    return {
      amount,
      description: dari,
      source: Source.JAGO,
      occurredAt,
      excluded: false,
      kind: 'INCOME',
    };
  }

  private parseTransfer(body: string, email: RawEmail): ParseResult | null {
    const jumlahRaw = extractField(body, 'Jumlah');
    const ke = extractField(body, 'Ke');
    const rekening =
      extractField(body, 'Nomor rekening') ||
      extractField(body, 'No. rekening') ||
      extractField(body, 'Rekening tujuan') ||
      extractField(body, 'Account number');
    const tanggalRaw = extractField(body, 'Tanggal transaksi') || extractField(body, 'Tanggal Transaksi');

    if (!jumlahRaw || !ke) return null;

    const amount = parseRupiah(jumlahRaw);
    const occurredAt = (tanggalRaw && parseEmailDate(tanggalRaw)) || new Date(parseInt(email.internalDate, 10));

    const isSelfTransfer = isInternalDestination({ accountNumber: rekening, beneficiaryName: ke });

    return {
      amount,
      description: ke,
      source: Source.JAGO,
      occurredAt,
      excluded: isSelfTransfer,
      excludeReason: isSelfTransfer ? 'Transfer ke rekening sendiri (internal)' : undefined,
      balanceOnly: isSelfTransfer,
    };
  }

  private parseQrisPayment(body: string, email: RawEmail): ParseResult | null {
    const jumlahRaw = extractField(body, 'Jumlah');
    const ke = extractField(body, 'Ke');
    const tanggalRaw = extractField(body, 'Tanggal Transaksi') || extractField(body, 'Tanggal transaksi');

    if (!jumlahRaw || !ke) return null;

    const amount = parseRupiah(jumlahRaw);
    const occurredAt = (tanggalRaw && parseEmailDate(tanggalRaw)) || new Date(parseInt(email.internalDate, 10));

    return {
      amount,
      description: ke,
      source: Source.JAGO,
      occurredAt,
      excluded: false,
    };
  }
}
