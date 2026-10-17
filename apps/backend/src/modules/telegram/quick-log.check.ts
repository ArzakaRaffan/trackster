/**
 * quick-log.check.ts — catat cepat Telegram ("kopi 25rb").
 * Jalankan: npx ts-node --transpile-only src/modules/telegram/quick-log.check.ts
 */
import * as assert from 'assert';
import { parseQuickLog } from './quick-log';

const ok = (text: string, description: string, amount: number, source: string | null = null, kind = 'expense', daysAgo = 0) =>
  assert.deepStrictEqual(parseQuickLog(text), { kind, description, amount, source, daysAgo }, text);
const no = (text: string) => assert.strictEqual(parseQuickLog(text), null, text);

ok('kopi 25rb', 'Kopi', 25000);
ok('Kopi kenangan 28.000', 'Kopi kenangan', 28000);
ok('makan siang 35k', 'Makan siang', 35000);
ok('makan siang 35 rb', 'Makan siang', 35000);
ok('parkir 5000', 'Parkir', 5000);
ok('25rb kopi', 'Kopi', 25000);
ok('servis motor 1,5jt', 'Servis motor', 1500000);
ok('laptop 12 juta', 'Laptop', 12000000);
ok('bensin 50rb jago', 'Bensin', 50000, 'JAGO');
ok('BCA token listrik 100.000', 'Token listrik', 100000, 'BCA');
ok('/catat parkir 2000', 'Parkir', 2000);
ok('/catat@TracksterBot es teh 500', 'Es teh', 500, null);
ok('  kopi   25rb  ', 'Kopi', 25000);

// Kemarin & pemasukan.
ok('kopi 25rb kemarin', 'Kopi', 25000, null, 'expense', 1);
ok('kemarin bensin 50rb jago', 'Bensin', 50000, 'JAGO', 'expense', 1);
ok('+gaji 5jt', 'Gaji', 5000000, null, 'income');
ok('+ freelance desain 1,2jt bca kemarin', 'Freelance desain', 1200000, 'BCA', 'income', 1);
no('+');
no('+berapa gajiku?');

// Pertanyaan / perintah → AI.
no('berapa pengeluaran bulan 10');
no('sisa budget hari ini?');
no('total jajan 2025');
no('kopi 25rb?');
no('/start abc123');
no('/hariini');
// Ambigu → AI.
no('halo');
no('25000');
no('kopi');
no('laptop 2025');
no('nomor 12');
no('kopi 12,5');
no('beli kopi susu gula aren di kafe dekat kantor 25rb');
no('kopi 0rb');
no('rumah 500jt');
no('/catat');

console.log('quick-log.check: OK');
