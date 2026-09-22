import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { EmailParser, RawEmail, ParseResult, extractField, parseRupiah, parseEmailDate } from './parser.interface';
import { isInternalDestination } from './own-accounts';

const BCA_SENDER_HINTS = ['bca', 'klikbca'];

// Transfer BCA → FLIPTECH = SoF funding ke Flip (bukan belanja akhir).
// Expense sebenarnya ada di email Flip (tujuan merchant / VA), kecuali tujuan rekening sendiri.
const FLIP_INTERMEDIARY_KEYWORDS = ['FLIPTECH'];

@Injectable()
export class BcaParser implements EmailParser {
  canHandle(email: RawEmail): boolean {
    const from = email.from.toLowerCase();
    return BCA_SENDER_HINTS.some((hint) => from.includes(hint));
  }

  parse(email: RawEmail): ParseResult | null {
    const body = email.body;

    if (!body.includes('Here are the details of your transaction')) {
      return null;
    }

    const transactionType = extractField(body, 'Transaction Type');
    const transferType = extractField(body, 'Transfer Type');

    if (transactionType) {
      return this.parseQrisPayment(body, email);
    }
    if (transferType) {
      return this.parseTransfer(body, email, transferType);
    }

    // Beberapa notifikasi VA / payment tidak pakai label Transfer Type persis — coba fallback.
    if (
      extractField(body, 'Transfer Amount') ||
      extractField(body, 'Transaction Amount') ||
      extractField(body, 'Amount')
    ) {
      return this.parseTransfer(body, email, 'fallback');
    }

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

  private parseTransfer(body: string, email: RawEmail, transferType: string): ParseResult | null {
    const transferAmountRaw =
      extractField(body, 'Transfer Amount') ||
      extractField(body, 'Transaction Amount') ||
      extractField(body, 'Amount');
    const beneficiaryName =
      extractField(body, 'Beneficiary Name') ||
      extractField(body, 'Beneficiary') ||
      extractField(body, 'Payment to') ||
      extractField(body, 'To');
    const beneficiaryAccount =
      extractField(body, 'Beneficiary Account') ||
      extractField(body, 'Beneficiary Account Number') ||
      extractField(body, 'Account Number') ||
      extractField(body, 'To Account');
    const dateRaw = extractField(body, 'Transaction Date') || extractField(body, 'Date');

    if (!transferAmountRaw || !beneficiaryName) return null;

    const amount = parseRupiah(transferAmountRaw);
    const occurredAt = (dateRaw && parseEmailDate(dateRaw)) || new Date(parseInt(email.internalDate, 10));

    const nameUpper = beneficiaryName.toUpperCase();
    const isFlipIntermediary = FLIP_INTERMEDIARY_KEYWORDS.some((kw) => nameUpper.includes(kw));
    const isOwnDestination = isInternalDestination({
      accountNumber: beneficiaryAccount,
      beneficiaryName,
    });

    // Flip intermediary (SoF) selalu exclude di sisi BCA — purpose final dibaca dari email Flip.
    // Transfer langsung ke rekening sendiri juga exclude.
    const excluded = isFlipIntermediary || isOwnDestination;
    let excludeReason: string | undefined;
    if (isFlipIntermediary) excludeReason = 'Transfer SoF ke Flip (FLIPTECH) — bukan expense akhir';
    else if (isOwnDestination) excludeReason = 'Transfer ke rekening sendiri (internal)';

    const vaHint = /virtual\s*account|va\b/i.test(transferType) || /virtual\s*account|va\b/i.test(body.slice(0, 500));
    const description = vaHint && !nameUpper.includes('VIRTUAL')
      ? `${beneficiaryName} (VA)`
      : beneficiaryName;

    return {
      amount,
      description,
      source: Source.BCA,
      occurredAt,
      excluded,
      excludeReason,
    };
  }
}
