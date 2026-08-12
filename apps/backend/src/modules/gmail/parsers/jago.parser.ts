import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { EmailParser, RawEmail, ParseResult, extractField, parseRupiah, parseEmailDate } from './parser.interface';

// TODO: konfirmasi domain email pengirim Jago yang sebenarnya, sementara deteksi pakai nama tampilan "Jago".
const JAGO_SENDER_HINTS = ['jago'];

// Nama pemilik akun, dipakai untuk deteksi self-transfer (transfer ke rekening sendiri = bukan pengeluaran).
// Diambil dari env var supaya tidak hardcoded dan mudah diubah kalau nama berubah/typo.
const OWNER_NAME = (process.env.OWNER_FULL_NAME || 'ARZAKA RAFFAN MAWARDI').toUpperCase();

@Injectable()
export class JagoParser implements EmailParser {
  canHandle(email: RawEmail): boolean {
    const from = email.from.toLowerCase();
    return JAGO_SENDER_HINTS.some((hint) => from.includes(hint));
  }

  parse(email: RawEmail): ParseResult | null {
    const subject = email.subject.toLowerCase();
    const body = email.body;

    if (subject.includes('melakukan transfer') || body.includes('melakukan transfer uang')) {
      return this.parseTransfer(body, email);
    }

    if (subject.includes('membayar ke') || body.includes('mengirimkan uang')) {
      return this.parseQrisPayment(body, email);
    }

    // Sub-format lain yang belum kita punya contohnya (misal terima dana masuk, tarik tunai)
    // TODO: tambahkan handling begitu ada contoh email barunya
    return null;
  }

  private parseTransfer(body: string, email: RawEmail): ParseResult | null {
    const jumlahRaw = extractField(body, 'Jumlah');
    const ke = extractField(body, 'Ke'); // baris pertama setelah "Ke" = nama penerima
    const tanggalRaw = extractField(body, 'Tanggal transaksi') || extractField(body, 'Tanggal Transaksi');

    if (!jumlahRaw || !ke) return null;

    const amount = parseRupiah(jumlahRaw);
    const occurredAt = (tanggalRaw && parseEmailDate(tanggalRaw)) || new Date(parseInt(email.internalDate, 10));

    const isSelfTransfer = ke.toUpperCase().includes(OWNER_NAME);

    return {
      amount,
      description: ke,
      source: Source.JAGO,
      occurredAt,
      excluded: isSelfTransfer,
      excludeReason: isSelfTransfer ? 'Transfer ke rekening sendiri (internal)' : undefined,
    };
  }

  private parseQrisPayment(body: string, email: RawEmail): ParseResult | null {
    const jumlahRaw = extractField(body, 'Jumlah');
    const ke = extractField(body, 'Ke'); // nama merchant
    const tanggalRaw = extractField(body, 'Tanggal Transaksi') || extractField(body, 'Tanggal transaksi');

    if (!jumlahRaw || !ke) return null;

    const amount = parseRupiah(jumlahRaw);
    const occurredAt = (tanggalRaw && parseEmailDate(tanggalRaw)) || new Date(parseInt(email.internalDate, 10));

    // Pembayaran ke merchant selalu dihitung sebagai expense, tidak perlu exclusion check
    return {
      amount,
      description: ke,
      source: Source.JAGO,
      occurredAt,
      excluded: false,
    };
  }
}
