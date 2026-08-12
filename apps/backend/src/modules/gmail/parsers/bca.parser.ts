import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { EmailParser, RawEmail, ParseResult, extractField, parseRupiah, parseEmailDate } from './parser.interface';

// TODO: konfirmasi domain/alamat email pengirim BCA yang sebenarnya (dari header email asli),
// sementara deteksi pakai nama tampilan "BCA" di sender field.
const BCA_SENDER_HINTS = ['bca', 'klikbca'];

// Keyword untuk exclude transfer top-up mingguan ke Jago via Flip.
// Dikonfirmasi dari email asli: Beneficiary Name = "FLIPTECH LENTERA IP PT"
const EXCLUDE_BENEFICIARY_KEYWORDS = ['FLIPTECH'];

@Injectable()
export class BcaParser implements EmailParser {
  canHandle(email: RawEmail): boolean {
    const from = email.from.toLowerCase();
    return BCA_SENDER_HINTS.some((hint) => from.includes(hint));
  }

  parse(email: RawEmail): ParseResult | null {
    const body = email.body;

    // Cuma proses email yang benar-benar notifikasi transaksi
    if (!body.includes('Here are the details of your transaction')) {
      return null;
    }

    const transactionType = extractField(body, 'Transaction Type'); // QRIS Payment, dll
    const transferType = extractField(body, 'Transfer Type'); // Transfer to BCA Account, dll

    if (transactionType) {
      return this.parseQrisPayment(body, email);
    }
    if (transferType) {
      return this.parseTransfer(body, email);
    }

    // Sub-format lain yang belum kita punya contohnya (misal Transfer to Other Bank, Debit Card, dll)
    // TODO: tambahkan handling begitu ada contoh email barunya
    return null;
  }

  private parseQrisPayment(body: string, email: RawEmail): ParseResult | null {
    const totalPaymentRaw = extractField(body, 'Total Payment');
    const paymentTo = extractField(body, 'Payment to');
    const dateRaw = extractField(body, 'Transaction Date');

    if (!totalPaymentRaw || !paymentTo) return null;

    const amount = parseRupiah(totalPaymentRaw);
    const occurredAt = (dateRaw && parseEmailDate(dateRaw)) || new Date(parseInt(email.internalDate, 10));

    return {
      amount,
      description: paymentTo,
      source: Source.BCA,
      occurredAt,
      excluded: false,
    };
  }

  private parseTransfer(body: string, email: RawEmail): ParseResult | null {
    const transferAmountRaw = extractField(body, 'Transfer Amount');
    const beneficiaryName = extractField(body, 'Beneficiary Name');
    const dateRaw = extractField(body, 'Transaction Date');

    if (!transferAmountRaw || !beneficiaryName) return null;

    const amount = parseRupiah(transferAmountRaw);
    const occurredAt = (dateRaw && parseEmailDate(dateRaw)) || new Date(parseInt(email.internalDate, 10));

    const isExcluded = EXCLUDE_BENEFICIARY_KEYWORDS.some((kw) =>
      beneficiaryName.toUpperCase().includes(kw),
    );

    return {
      amount,
      description: beneficiaryName,
      source: Source.BCA,
      occurredAt,
      excluded: isExcluded,
      excludeReason: isExcluded ? 'Transfer top-up mingguan ke Jago via Flip' : undefined,
    };
  }
}
