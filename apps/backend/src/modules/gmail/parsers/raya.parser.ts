import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { EmailParser, RawEmail, ParseResult, extractField, parseRupiah, parseEmailDate } from './parser.interface';

/**
 * Bank Raya. Format "Label : Value". Tiga subject:
 * "Transaksi QRIS Berhasil" (expense), "Notifikasi Uang Masuk" & "Asyik! Cashback Kamu Masuk, Nih" (income).
 */
@Injectable()
export class RayaParser implements EmailParser {
  canHandle(email: RawEmail): boolean {
    return email.from.toLowerCase().includes('raya');
  }

  parse(email: RawEmail): ParseResult | null {
    const subject = email.subject.toLowerCase();
    const body = email.body;

    let description: string | null;
    let amountRaw: string | null;
    let kind: 'EXPENSE' | 'INCOME';
    if (subject.includes('transaksi qris berhasil')) {
      kind = 'EXPENSE';
      description = extractField(body, 'Nama Merchant', { exact: true });
      amountRaw = extractField(body, 'Total Pembayaran', { exact: true }) || extractField(body, 'Nominal', { exact: true });
    } else if (subject.includes('uang masuk')) {
      kind = 'INCOME';
      description = extractField(body, 'Tipe Transaksi', { exact: true }) || 'Transfer Masuk'; // email tidak memuat nama pengirim
      amountRaw = extractField(body, 'Jumlah', { exact: true });
    } else if (subject.includes('cashback')) {
      kind = 'INCOME';
      description = 'Cashback Raya';
      amountRaw = extractField(body, 'Nominal', { exact: true });
    } else {
      return null;
    }

    if (!description || !amountRaw) return null;
    const amount = parseRupiah(amountRaw);
    if (!amount) return null;

    // Jam bisa "17.44 WIB" (uang masuk) atau "17:49 WIB" (QRIS/cashback).
    const dt = body.match(/(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})[\s\S]{0,40}?(\d{1,2})[:.](\d{2})/);
    const occurredAt = (dt && parseEmailDate(`${dt[1]} ${dt[2]}:${dt[3]}`)) || new Date(parseInt(email.internalDate, 10));

    return { amount, description, source: Source.RAYA, occurredAt, excluded: false, kind };
  }
}
