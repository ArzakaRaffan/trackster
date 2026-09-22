import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { EmailParser, RawEmail, ParseResult, extractField, parseRupiah, parseEmailDate } from './parser.interface';
import { isInternalDestination, isOwnAccountNumber } from './own-accounts';

const FLIP_SENDER_HINTS = ['flip.id', 'fliptech', 'flip '];

/**
 * Parser email Flip.
 * - Transfer ke rekening sendiri (BCA/Jago/Blu owner) → excluded (internal).
 * - Transfer ke beneficiary lain (merchant / orang lain / VA e-commerce) → dicatat sebagai expense.
 * Source of Fund (SoF) biasanya rekening BCA owner; SoF sendiri bukan alasan exclude.
 */
@Injectable()
export class FlipParser implements EmailParser {
  canHandle(email: RawEmail): boolean {
    const from = email.from.toLowerCase();
    const subject = email.subject.toLowerCase();
    if (FLIP_SENDER_HINTS.some((h) => from.includes(h.trim()))) return true;
    // Kadang from generic tapi subject/body jelas Flip
    if (subject.includes('flip') && (email.body.includes('Source of Fund') || email.body.includes('SoF'))) {
      return true;
    }
    return false;
  }

  parse(email: RawEmail): ParseResult | null {
    const body = email.body;

    const amountRaw =
      extractField(body, 'Amount') ||
      extractField(body, 'Jumlah') ||
      extractField(body, 'Nominal') ||
      extractField(body, 'Transfer Amount');
    const beneficiaryName =
      extractField(body, 'Beneficiary Name') ||
      extractField(body, 'Beneficiary') ||
      extractField(body, 'Nama Penerima') ||
      extractField(body, 'Penerima') ||
      extractField(body, 'To');
    const beneficiaryAccount =
      extractField(body, 'Beneficiary Account') ||
      extractField(body, 'Beneficiary Account Number') ||
      extractField(body, 'Nomor Rekening') ||
      extractField(body, 'No. Rekening') ||
      extractField(body, 'Account Number') ||
      extractField(body, 'Rekening Tujuan');
    const sof =
      extractField(body, 'Source of Fund') ||
      extractField(body, 'SoF') ||
      extractField(body, 'Sumber Dana');
    const dateRaw =
      extractField(body, 'Transaction Date') ||
      extractField(body, 'Tanggal') ||
      extractField(body, 'Date') ||
      extractField(body, 'Completed At');

    if (!amountRaw) return null;
    // Minimal harus ada nama atau nomor tujuan
    if (!beneficiaryName && !beneficiaryAccount) return null;

    const amount = parseRupiah(amountRaw);
    if (!amount || amount <= 0) return null;

    const occurredAt = (dateRaw && parseEmailDate(dateRaw)) || new Date(parseInt(email.internalDate, 10));

    const excluded = isInternalDestination({
      accountNumber: beneficiaryAccount,
      beneficiaryName,
    });

    // Deskripsi: prioritaskan nama; sisipkan bank/account pendek biar beda di list
    const accountDigits = (beneficiaryAccount || '').replace(/\D/g, '');
    const tail = accountDigits ? ` · …${accountDigits.slice(-4)}` : '';
    const description = `${beneficiaryName || 'Flip transfer'}${tail}`;

    // Source accounting: Flip dibiayai dari BCA owner SoF → catat sebagai BCA
    // (konsisten dengan saldo BCA yang berkurang saat SoF). Kalau SoF jelas Jago, pakai JAGO.
    let source: Source = Source.BCA;
    if (sof) {
      const sofUpper = sof.toUpperCase();
      if (sofUpper.includes('JAGO')) source = Source.JAGO;
      else if (isOwnAccountNumber(sof) || sofUpper.includes('BCA') || sof.replace(/\D/g, '').startsWith('6611')) {
        source = Source.BCA;
      }
    }

    return {
      amount,
      description,
      source,
      occurredAt,
      excluded,
      excludeReason: excluded
        ? 'Transfer Flip ke rekening sendiri (internal)'
        : undefined,
    };
  }
}
