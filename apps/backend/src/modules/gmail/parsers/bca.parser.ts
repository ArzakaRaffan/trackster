import { Injectable } from '@nestjs/common';
import { Source, Category } from '@prisma/client';
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
      // Cek Virtual Account lebih dulu sebelum fallback ke transfer biasa
      if (/virtual\s*account/i.test(transferType)) {
        return this.parseVirtualAccount(body, email);
      }
      return this.parseTransfer(body, email, transferType);
    }

    // Beberapa notifikasi pakai "Type of Transaction" (QRIS Transfer) — fallback ke QRIS kalau ada Payment to
    const typeOfTransaction = extractField(body, 'Type of Transaction');
    if (typeOfTransaction) {
      return this.parseQrisPayment(body, email);
    }

    // Fallback: beberapa notifikasi VA / payment tidak pakai label Transfer Type persis
    if (
      extractField(body, 'Transfer Amount') ||
      extractField(body, 'Transaction Amount') ||
      extractField(body, 'Amount')
    ) {
      return this.parseTransfer(body, email, 'fallback');
    }

    return null;
  }

  /**
   * Format VA BCA:
   *   Transfer Type            : Transfer to BCA Virtual Account
   *   Company/Product Name     : PT DOMPET ANAK BANGSA / GOPAY TOPUP
   *   Pay Amount               : IDR 10,000.00
   *   Admin Fee                : IDR 1,000.00
   *   Total Payment            : IDR 11,000.00
   *
   * amount = Total Payment (semua uang keluar dari BCA, termasuk admin fee)
   * description dibentuk dari Company/Product Name
   */
  private parseVirtualAccount(body: string, email: RawEmail): ParseResult | null {
    const totalPaymentRaw = extractField(body, 'Total Payment');
    const payAmountRaw = extractField(body, 'Pay Amount');
    const companyProduct = extractField(body, 'Company/Product Name');
    // "Name" adalah nama VA atau nama registrasi user di e-wallet — pakai exact supaya tidak nyangkut di Company/Product Name.
    // JANGAN gunakan Name untuk isInternalDestination: e-wallet (OVO, ShopeePay) menaruh nama owner di sini,
    // bukan kode VA, sehingga pencocokan nama akan false-positive.
    const vaName = extractField(body, 'Name', { exact: true });
    // "BCA Virtual Account No." adalah nomor VA tujuan — ini yang aman dicek vs own accounts
    const vaNumber = extractField(body, 'BCA Virtual Account No.');
    const dateRaw = extractField(body, 'Transaction Date');

    const amountRaw = totalPaymentRaw || payAmountRaw;
    if (!amountRaw) return null;

    const amount = parseRupiah(amountRaw);
    const occurredAt = (dateRaw && parseEmailDate(dateRaw)) || new Date(parseInt(email.internalDate, 10));

    const description = this.buildVaDescription(companyProduct, vaName);

    // categoryHint berdasarkan nama produk
    const categoryHint = this.inferVaCategoryHint(companyProduct, vaName);

    // Cek apakah VA number ini adalah rekening sendiri (mis. top-up Jago via VA BCA).
    // Hanya cek accountNumber — JANGAN cek beneficiaryName karena e-wallet isi dengan nama owner.
    const isOwnDestination = isInternalDestination({ accountNumber: vaNumber });

    if (isOwnDestination) {
      return {
        amount,
        description,
        source: Source.BCA,
        occurredAt,
        excluded: true,
        excludeReason: 'VA ke rekening sendiri (internal top-up)',
        balanceOnly: true,
        categoryHint,
      };
    }

    return {
      amount,
      description,
      source: Source.BCA,
      occurredAt,
      excluded: false,
      categoryHint,
    };
  }

  /**
   * Bentuk deskripsi dari Company/Product Name:
   * - Mengandung "GOPAY" → "GoPay Top-up (VA)"
   * - Ada " / " → ambil bagian setelah " / ", title-case, tambah " (VA)"
   * - Tidak ada " / " → pakai seluruh company name atau vaName, tambah " (VA)"
   */
  private buildVaDescription(companyProduct: string | null, vaName: string | null): string {
    if (companyProduct) {
      const upper = companyProduct.toUpperCase();

      if (upper.includes('GOPAY')) return 'GoPay Top-up (VA)';
      if (upper.includes('SHOPEEPAY') || upper.includes('AIRPAY')) return 'ShopeePay Top-up (VA)';
      if (upper.includes('OVO')) return 'OVO Top-up (VA)';
      if (upper.includes('DANA')) return 'DANA Top-up (VA)';
      if (upper.includes('LINKAJA')) return 'LinkAja Top-up (VA)';

      const slashIdx = companyProduct.indexOf(' / ');
      if (slashIdx !== -1) {
        const productPart = companyProduct.slice(slashIdx + 3).trim();
        if (productPart) return `${this.toTitleCase(productPart)} (VA)`;
      }
      return `${this.toTitleCase(companyProduct)} (VA)`;
    }

    if (vaName) return `${vaName} (VA)`;
    return 'Virtual Account (VA)';
  }

  /** Inferensi categoryHint dari nama produk VA — top-up e-wallet selalu TOPUP. */
  private inferVaCategoryHint(companyProduct: string | null, _vaName: string | null): Category {
    if (companyProduct && /GOPAY|SHOPEEPAY|AIRPAY|OVO|DANA|LINKAJA/i.test(companyProduct)) return Category.TOPUP;
    return Category.LAINNYA;
  }

  private toTitleCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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
      extractField(body, 'To', { exact: true });
    const beneficiaryAccount =
      extractField(body, 'Beneficiary Account') ||
      extractField(body, 'Beneficiary Account Number') ||
      extractField(body, 'Account Number') ||
      extractField(body, 'To Account');
    const dateRaw = extractField(body, 'Transaction Date') || extractField(body, 'Date', { exact: true });

    if (!transferAmountRaw || !beneficiaryName) return null;

    const amount = parseRupiah(transferAmountRaw);
    const occurredAt = (dateRaw && parseEmailDate(dateRaw)) || new Date(parseInt(email.internalDate, 10));

    const nameUpper = beneficiaryName.toUpperCase();
    const isFlipIntermediary = FLIP_INTERMEDIARY_KEYWORDS.some((kw) => nameUpper.includes(kw));
    const isOwnDestination = isInternalDestination({
      accountNumber: beneficiaryAccount,
      beneficiaryName,
    });

    // Flip intermediary (SoF) selalu exclude di sisi BCA — purpose final dibaca dari email Flip,
    // saldo TIDAK gerak di sini (receipt Flip yang pegang). Transfer langsung ke rekening sendiri
    // juga exclude, tapi uangnya beneran keluar dari BCA sekarang → balanceOnly.
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
      balanceOnly: isOwnDestination,
    };
  }
}
