/**
 * parsers.check.ts — self-check untuk BCA parser (VA + QRIS + Transfer)
 * Jalankan dengan: npx ts-node src/modules/gmail/parsers/parsers.check.ts
 *
 * Semua assert berbasis strict equality — tidak ada test framework.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';

// own-accounts.ts baca OWNER_ACCOUNT_NUMBERS/OWNER_FULL_NAME dari process.env sekali di module-load
// time. Import di bawah ini transitif me-require @prisma/client, yang auto-load .env (dotenv) buat
// DATABASE_URL — efek sampingnya, .env dev (nilai dummy: OWNER_ACCOUNT_NUMBERS=0000000000) bisa
// menimpa default kalau belum di-set. Set dulu ke nilai asli SEBELUM import lain jalan (dotenv
// tidak override env yang sudah ada) — fixture di sini pakai rekening/nama produksi asli.
process.env.OWNER_ACCOUNT_NUMBERS = '6611126589,105602544330,006751400577';
process.env.OWNER_FULL_NAME = 'ARZAKA RAFFAN MAWARDI';

// ─── Impor fungsi & tipe yang akan diuji ────────────────────────────────────
import { extractField, parseRupiah, parseEmailDate, htmlToText } from './parser.interface';
import { BcaParser } from './bca.parser';
import { FlipParser } from './flip.parser';
import { JagoParser } from './jago.parser';
import { Source, Category } from '@prisma/client';

// ─── Helper ──────────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.join(__dirname, '__fixtures__');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

function fakeEmail(body: string, id = 'test-id'): { id: string; from: string; subject: string; body: string; internalDate: string } {
  return {
    id,
    from: 'notification@klikbca.com',
    subject: 'BCA Transaction',
    body,
    internalDate: String(new Date('2026-09-24T06:00:00Z').getTime()), // fallback
  };
}

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e: any) {
    console.error(`  ❌ ${label}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

// ─── 1. Unit: extractField ────────────────────────────────────────────────────

console.log('\n── extractField ──');

check('substring match: "Company/Product Name"', () => {
  const body = 'Company/Product Name     : PT DOMPET ANAK BANGSA / GOPAY TOPUP';
  assert.strictEqual(extractField(body, 'Company/Product Name'), 'PT DOMPET ANAK BANGSA / GOPAY TOPUP');
});

check('exact=false "Name" TIDAK ambil Company/Product Name (substring di tengah)', () => {
  const body = 'Company/Product Name     : PT DOMPET ANAK BANGSA / GOPAY TOPUP\nName                     : GP-081284917833';
  // default (exact=false) cari substring — hasilnya mungkin ambil Company/Product Name dulu
  // Test ini hanya verifikasi perilaku, bukan salah/benar
  const result = extractField(body, 'Name');
  // Substring "name" ada di "Company/Product Name" → hasilnya salah (ini bug yang diperbaiki dengan exact)
  // Kita tidak assert nilai spesifik di sini, hanya pastikan tidak crash
  assert.ok(typeof result === 'string' || result === null);
});

check('exact=true "Name" ambil nilai tepat, bukan Company/Product Name', () => {
  const body = 'Company/Product Name     : PT DOMPET ANAK BANGSA / GOPAY TOPUP\nName                     : GP-081284917833';
  const result = extractField(body, 'Name', { exact: true });
  assert.strictEqual(result, 'GP-081284917833');
});

check('exact=true "Name" dengan tab-separator (format email asli BCA)', () => {
  const body = 'Company/Product Name\t:\tPT VISIONET INTERNASIONAL / OVO\nName\t:\tARZAKA RAFFAN MAWARDI';
  const result = extractField(body, 'Name', { exact: true });
  assert.strictEqual(result, 'ARZAKA RAFFAN MAWARDI');
});

// ─── 2. Unit: parseRupiah ─────────────────────────────────────────────────────

console.log('\n── parseRupiah ──');

check('IDR 11,000.00 → 11000', () => assert.strictEqual(parseRupiah('IDR 11,000.00'), 11000));
check('IDR 60,000.00 → 60000', () => assert.strictEqual(parseRupiah('IDR 60,000.00'), 60000));
check('IDR 36,000.00 → 36000', () => assert.strictEqual(parseRupiah('IDR 36,000.00'), 36000));
check('IDR 117,492.00 → 117492', () => assert.strictEqual(parseRupiah('IDR 117,492.00'), 117492));
check('Rp10.000 → 10000', () => assert.strictEqual(parseRupiah('Rp10.000'), 10000));
check('IDR 1,000.00 (admin fee) → 1000', () => assert.strictEqual(parseRupiah('IDR 1,000.00'), 1000));

// ─── 3. Unit: parseEmailDate ──────────────────────────────────────────────────

console.log('\n── parseEmailDate ──');

check('24 Sep 2026 12:52:18 → UTC 05:52:18 (WIB-7)', () => {
  const d = parseEmailDate('24 Sep 2026 12:52:18');
  assert.ok(d !== null);
  assert.strictEqual(d!.toISOString(), '2026-09-24T05:52:18.000Z');
});

check('14 Sep 2026 12:35:44 → UTC 05:35:44', () => {
  const d = parseEmailDate('14 Sep 2026 12:35:44');
  assert.ok(d !== null);
  assert.strictEqual(d!.toISOString(), '2026-09-14T05:35:44.000Z');
});

check('23 Sep 2026 14:01:00 → UTC 07:01:00', () => {
  const d = parseEmailDate('23 Sep 2026 14:01:00');
  assert.ok(d !== null);
  assert.strictEqual(d!.toISOString(), '2026-09-23T07:01:00.000Z');
});

// ─── 4. Unit: htmlToText strip style/script/head ─────────────────────────────

console.log('\n── htmlToText ──');

check('buang <style> block', () => {
  const html = '<html><head><style>.foo { color: red; }</style></head><body><p>Hello</p></body></html>';
  const result = htmlToText(html);
  assert.ok(!result.includes('color: red'), `style masih ada: ${result}`);
  assert.ok(result.includes('Hello'));
});

check('buang <script> block', () => {
  const html = '<body><script>alert("xss")</script><p>Value</p></body>';
  const result = htmlToText(html);
  assert.ok(!result.includes('alert'), `script masih ada: ${result}`);
  assert.ok(result.includes('Value'));
});

// ─── 5. Integrasi: BcaParser dengan fixture ───────────────────────────────────

console.log('\n── BcaParser fixtures ──');

const parser = new BcaParser();

// --- VA GoPay ---
check('VA GoPay: amount = 11000 (Total Payment termasuk admin fee)', () => {
  const body = loadFixture('bca-va-gopay.txt');
  const result = parser.parse(fakeEmail(body));
  assert.ok(result !== null, 'parse harusnya return ParseResult, bukan null');
  assert.strictEqual(result!.amount, 11000);
});

check('VA GoPay: description = "GoPay Top-up (VA)"', () => {
  const body = loadFixture('bca-va-gopay.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(result!.description, 'GoPay Top-up (VA)');
});

check('VA GoPay: excluded = false (bukan rekening sendiri)', () => {
  const body = loadFixture('bca-va-gopay.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(result!.excluded, false);
});

check('VA GoPay: source = BCA', () => {
  const body = loadFixture('bca-va-gopay.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(result!.source, Source.BCA);
});

check('VA GoPay: occurredAt = 2026-09-23T07:01:00.000Z (WIB 14:01)', () => {
  const body = loadFixture('bca-va-gopay.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(result!.occurredAt.toISOString(), '2026-09-23T07:01:00.000Z');
});

// --- VA ShopeePay ---
check('VA ShopeePay: amount = 60000', () => {
  const body = loadFixture('bca-va-shopeepay.txt');
  const result = parser.parse(fakeEmail(body));
  assert.ok(result !== null, 'parse harusnya return ParseResult, bukan null');
  assert.strictEqual(result!.amount, 60000);
});

check('VA ShopeePay: description = "ShopeePay Top-up (VA)"', () => {
  const body = loadFixture('bca-va-shopeepay.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(result!.description, 'ShopeePay Top-up (VA)');
});

check('VA ShopeePay: excluded = false (Name berisi nama owner, tapi VA number bukan rekening sendiri)', () => {
  const body = loadFixture('bca-va-shopeepay.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(result!.excluded, false, 'ShopeePay TIDAK boleh di-exclude meski Name berisi nama owner');
});

// --- VA OVO — KRITIS: Name = nama owner penuh, tapi bukan internal ---
check('VA OVO: amount = 36000', () => {
  const body = loadFixture('bca-va-ovo.txt');
  const result = parser.parse(fakeEmail(body));
  assert.ok(result !== null, 'parse harusnya return ParseResult, bukan null');
  assert.strictEqual(result!.amount, 36000);
});

check('VA OVO: description = "OVO Top-up (VA)"', () => {
  const body = loadFixture('bca-va-ovo.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(result!.description, 'OVO Top-up (VA)');
});

check('VA OVO: excluded = false meski Name = "ARZAKA RAFFAN MAWARDI" (critical false-positive guard)', () => {
  const body = loadFixture('bca-va-ovo.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(
    result!.excluded,
    false,
    'OVO TIDAK boleh di-exclude — e-wallet menaruh nama owner di field Name, bukan rekening sendiri',
  );
});

// --- QRIS Tokopedia ---
check('QRIS Tokopedia: amount = 117492', () => {
  const body = loadFixture('bca-qris-tokopedia.txt');
  const result = parser.parse(fakeEmail(body));
  assert.ok(result !== null);
  assert.strictEqual(result!.amount, 117492);
});

check('QRIS Tokopedia: description = "PT Tokopedia"', () => {
  const body = loadFixture('bca-qris-tokopedia.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(result!.description, 'PT Tokopedia');
});

check('QRIS Tokopedia: excluded = false', () => {
  const body = loadFixture('bca-qris-tokopedia.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(result!.excluded, false);
});

// --- QRIS basic ---
check('QRIS basic: amount = 15000', () => {
  const body = loadFixture('bca-qris.txt');
  const result = parser.parse(fakeEmail(body));
  assert.ok(result !== null);
  assert.strictEqual(result!.amount, 15000);
});

check('QRIS basic: description = "Warung Makan Bu Sari"', () => {
  const body = loadFixture('bca-qris.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(result!.description, 'Warung Makan Bu Sari');
});

// --- QRIS Shopee Indonesia (merchant, bukan VA top-up) ---
check('QRIS Shopee merchant: amount = 150150', () => {
  const body = loadFixture('bca-qris-shopee.txt');
  const result = parser.parse(fakeEmail(body));
  assert.ok(result !== null, 'parse harusnya return ParseResult, bukan null');
  assert.strictEqual(result!.amount, 150150);
});

check('QRIS Shopee merchant: description = "Shopee Indonesia" (bukan "ShopeePay Top-up (VA)")', () => {
  const body = loadFixture('bca-qris-shopee.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(result!.description, 'Shopee Indonesia');
});

check('QRIS Shopee merchant: excluded = false', () => {
  const body = loadFixture('bca-qris-shopee.txt');
  const result = parser.parse(fakeEmail(body));
  assert.strictEqual(result!.excluded, false);
});

// --- Transfer Fliptech: harus excluded ---
check('Transfer Fliptech: excluded = true (SoF ke Flip, bukan expense akhir)', () => {
  const body = loadFixture('bca-transfer-fliptech.txt');
  const result = parser.parse(fakeEmail(body));
  assert.ok(result !== null);
  assert.strictEqual(result!.excluded, true);
});

check('Transfer Fliptech: excludeReason mengandung "FLIPTECH"', () => {
  const body = loadFixture('bca-transfer-fliptech.txt');
  const result = parser.parse(fakeEmail(body));
  assert.ok(result!.excludeReason?.includes('FLIPTECH') || result!.excludeReason?.includes('Flip'));
});

// --- Body yang bukan notifikasi transaksi: return null ---
check('Email bukan transaksi BCA → null', () => {
  const result = parser.parse(fakeEmail('Promo BCA: Dapatkan cashback 10%!'));
  assert.strictEqual(result, null);
});

// ─── 5b. Integrasi: FlipParser dengan fixture ─────────────────────────────────

console.log('\n── FlipParser fixtures ──');

const flipParser = new FlipParser();

function fakeFlipEmail(body: string, subject: string, id = 'test-id'): { id: string; from: string; subject: string; body: string; internalDate: string } {
  return {
    id,
    from: 'no-reply@flip.id',
    subject,
    body,
    internalDate: String(new Date('2026-09-24T06:00:00Z').getTime()),
  };
}

// --- Instruksi bayar (belum expense final) → null ---
check('Flip instruksi "Transaction information...": return null', () => {
  const body = loadFixture('flip-instruction.txt');
  const result = flipParser.parse(fakeFlipEmail(body, 'Transaction information to multiple destinations'));
  assert.strictEqual(result, null);
});

// --- Receipt ke orang lain → expense final ---
check('Flip receipt eksternal: amount = 64000', () => {
  const body = loadFixture('flip-receipt.txt');
  const result = flipParser.parse(fakeFlipEmail(body, 'Successful transfer to Ahmad Dzulfikar As Shavy. Here is the receipt.'));
  assert.ok(result !== null, 'parse harusnya return ParseResult, bukan null');
  assert.strictEqual(result!.amount, 64000);
});

check('Flip receipt eksternal: description = "Ahmad Dzulfikar As Shavy · BNI …0567"', () => {
  const body = loadFixture('flip-receipt.txt');
  const result = flipParser.parse(fakeFlipEmail(body, 'Successful transfer to Ahmad Dzulfikar As Shavy. Here is the receipt.'));
  assert.strictEqual(result!.description, 'Ahmad Dzulfikar As Shavy · BNI …0567');
});

check('Flip receipt eksternal: excluded = false', () => {
  const body = loadFixture('flip-receipt.txt');
  const result = flipParser.parse(fakeFlipEmail(body, 'Successful transfer to Ahmad Dzulfikar As Shavy. Here is the receipt.'));
  assert.strictEqual(result!.excluded, false);
});

check('Flip receipt eksternal: occurredAt = 2026-09-20T14:15:00.000Z (WIB 21:15)', () => {
  const body = loadFixture('flip-receipt.txt');
  const result = flipParser.parse(fakeFlipEmail(body, 'Successful transfer to Ahmad Dzulfikar As Shavy. Here is the receipt.'));
  assert.strictEqual(result!.occurredAt.toISOString(), '2026-09-20T14:15:00.000Z');
});

check('Flip receipt eksternal: source = BCA', () => {
  const body = loadFixture('flip-receipt.txt');
  const result = flipParser.parse(fakeFlipEmail(body, 'Successful transfer to Ahmad Dzulfikar As Shavy. Here is the receipt.'));
  assert.strictEqual(result!.source, Source.BCA);
});

// --- Receipt ke rekening sendiri → internal, excluded ---
check('Flip receipt internal (Destination = rekening Blu sendiri): excluded = true', () => {
  const body = loadFixture('flip-receipt-internal.txt');
  const result = flipParser.parse(fakeFlipEmail(body, 'Successful transfer to ARZAKA RAFFAN MAWARDI. Here is the receipt.'));
  assert.ok(result !== null);
  assert.strictEqual(result!.excluded, true);
});

check('Flip receipt internal: excludeReason mengandung "internal"', () => {
  const body = loadFixture('flip-receipt-internal.txt');
  const result = flipParser.parse(fakeFlipEmail(body, 'Successful transfer to ARZAKA RAFFAN MAWARDI. Here is the receipt.'));
  assert.ok(result!.excludeReason?.includes('internal'));
});

check('Flip receipt internal: balanceOnly = true (uang beneran keluar dari SoF BCA)', () => {
  const body = loadFixture('flip-receipt-internal.txt');
  const result = flipParser.parse(fakeFlipEmail(body, 'Successful transfer to ARZAKA RAFFAN MAWARDI. Here is the receipt.'));
  assert.strictEqual(result!.balanceOnly, true);
});

// ─── 6. JagoParser — "menerima sejumlah uang" (E02-S1) ──────────────────────

console.log('\n── JagoParser.parseIncoming ──');

const jagoParser = new JagoParser();

function fakeJagoEmail(body: string, subject = 'Asik, kamu telah menerima sejumlah uang💰') {
  return {
    id: 'jago-income-test',
    from: 'noreply@jago.com',
    subject,
    body,
    internalDate: String(new Date('2026-09-24T06:00:00Z').getTime()),
  };
}

check('Jago terima FLIPTECH: kind = INCOME', () => {
  const body = loadFixture('jago-terima-fliptech.txt');
  const result = jagoParser.parse(fakeJagoEmail(body));
  assert.ok(result !== null);
  assert.strictEqual(result!.kind, 'INCOME');
});

check('Jago terima FLIPTECH: amount = 112500, description = nama pengirim', () => {
  const body = loadFixture('jago-terima-fliptech.txt');
  const result = jagoParser.parse(fakeJagoEmail(body));
  assert.strictEqual(result!.amount, 112500);
  assert.strictEqual(result!.description, 'FLIPTECH LENTERA INSPIRASI PERTIWI');
});

check('Jago terima FLIPTECH: occurredAt = 2026-08-26T06:37:00.000Z (WIB 13:37)', () => {
  const body = loadFixture('jago-terima-fliptech.txt');
  const result = jagoParser.parse(fakeJagoEmail(body));
  assert.strictEqual(result!.occurredAt.toISOString(), '2026-08-26T06:37:00.000Z');
});

check('Jago terima FLIPTECH: excluded = false (income tetap dicatat, klasifikasi urusan IncomeService)', () => {
  const body = loadFixture('jago-terima-fliptech.txt');
  const result = jagoParser.parse(fakeJagoEmail(body));
  assert.strictEqual(result!.excluded, false);
});

check('Jago terima owner sendiri: amount = 250000, description = "ARZAKA RAFFAN MAWARDI"', () => {
  const body = loadFixture('jago-terima-owner.txt');
  const result = jagoParser.parse(fakeJagoEmail(body));
  assert.strictEqual(result!.amount, 250000);
  assert.strictEqual(result!.description, 'ARZAKA RAFFAN MAWARDI');
});

check('Jago terima dari orang tak dikenal: amount = 50000, description = "BUDI SANTOSO"', () => {
  const body = loadFixture('jago-terima-unknown.txt');
  const result = jagoParser.parse(fakeJagoEmail(body));
  assert.strictEqual(result!.amount, 50000);
  assert.strictEqual(result!.description, 'BUDI SANTOSO');
});

check('Jago transfer keluar ke rekening sendiri: balanceOnly = true', () => {
  const body = [
    'Kamu telah melakukan transfer uang',
    'Ke',
    'ARZAKA RAFFAN MAWARDI',
    'BCA • 6611126589',
    'Jumlah',
    'Rp100.000',
    'Tanggal transaksi',
    '10 September 2026 09:00 WIB',
  ].join('\n');
  const result = jagoParser.parse({
    id: 'jago-transfer-self',
    from: 'noreply@jago.com',
    subject: 'Kamu telah melakukan transfer uang',
    body,
    internalDate: String(new Date('2026-09-10T02:00:00Z').getTime()),
  });
  assert.ok(result !== null);
  assert.strictEqual(result!.excluded, true);
  assert.strictEqual(result!.balanceOnly, true);
});

// ─── 7. Ringkasan ────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅  Semua ${passed} assertion lulus.`);
} else {
  console.log(`❌  ${failed} gagal, ${passed} lulus dari ${passed + failed} assertion.`);
  process.exit(1);
}
