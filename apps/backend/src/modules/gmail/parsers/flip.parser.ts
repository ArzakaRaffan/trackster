import { Injectable } from '@nestjs/common';
import { Category, Source } from '@prisma/client';
import { EmailParser, RawEmail, ParseResult, extractField, parseRupiah, parseEmailDate } from './parser.interface';
import { isInternalDestination } from './own-accounts';

const FLIP_SENDER_HINTS = ['flip.id', 'fliptech', 'flip '];

/**
 * Parser email Flip.
 * - Subject "Transaction information..." = instruksi bayar ke rekening Flip (belum expense final,
 *   uangnya baru dianggap keluar begitu SoF BCA memotong saldo → diabaikan di sini, sudah tercatat
 *   dari sisi BCA lewat exclusion FLIPTECH).
 * - Subject "Successful transfer to <Nama>..." = expense final. Transfer ke rekening sendiri
 *   (BCA/Jago/Blu owner) → excluded (internal). Ke orang/merchant lain → dicatat sebagai expense.
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
    if (/transaction information/i.test(email.subject)) return null;

    const body = email.body;

    const destinationName = extractField(body, 'Destination Name', { exact: true });
    const destinationBank = extractField(body, 'Destination Bank', { exact: true });
    const destinationAccount = extractField(body, 'Destination Account Number', { exact: true });
    const timeRaw = extractField(body, 'Time', { exact: true });
    const amountRaw = extractField(body, 'Amount');

    if (!amountRaw) return null;
    if (!destinationName && !destinationAccount) return null;

    const amount = parseRupiah(amountRaw);
    if (!amount || amount <= 0) return null;

    const occurredAt = (timeRaw && parseEmailDate(timeRaw)) || new Date(parseInt(email.internalDate, 10));

    const excluded = isInternalDestination({
      accountNumber: destinationAccount,
      beneficiaryName: destinationName,
    });

    // Deskripsi: "<Nama> · <Bank> …<4 digit rekening>"
    const accountDigits = (destinationAccount || '').replace(/\D/g, '');
    const tail = [destinationBank, accountDigits ? `…${accountDigits.slice(-4)}` : null].filter(Boolean).join(' ');
    const description = [destinationName || 'Flip transfer', tail].filter(Boolean).join(' · ');
    if (description.length > 80 || /[{}]/.test(description)) return null;

    return {
      amount,
      description,
      source: Source.BCA, // Flip selalu dibiayai dari SoF BCA owner
      occurredAt,
      excluded,
      excludeReason: excluded ? 'Transfer Flip ke rekening sendiri (internal)' : undefined,
      categoryHint: excluded ? undefined : Category.TRANSFER,
    };
  }
}
