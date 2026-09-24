/**
 * merchant-key.check.ts — self-check untuk normalisasi merchantKey (E00-S3)
 * Jalankan dengan: npx ts-node src/common/merchant-key.check.ts
 */
import * as assert from 'assert';
import { merchantKey } from './merchant-key';

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

console.log('\n── merchantKey ──');

check('"Kopi Kenangan 1320" → "kopi kenangan"', () => {
  assert.strictEqual(merchantKey('Kopi Kenangan 1320'), 'kopi kenangan');
});

check('"Kopi Kenangan QR BRI 1 1" → "kopi kenangan" (varian sama merchant)', () => {
  assert.strictEqual(merchantKey('Kopi Kenangan QR BRI 1 1'), 'kopi kenangan');
});

check('case-insensitive: "KOPI KENANGAN 999" → sama dengan versi title-case', () => {
  assert.strictEqual(merchantKey('KOPI KENANGAN 999'), merchantKey('Kopi Kenangan 1320'));
});

check('nama orang pendek tidak berubah: "Ahmad Dzulfikar As Shavy" → "ahmad dzulfikar as"', () => {
  assert.strictEqual(merchantKey('Ahmad Dzulfikar As Shavy'), 'ahmad dzulfikar as');
});

check('deskripsi 1 kata: "Indomaret" → "indomaret"', () => {
  assert.strictEqual(merchantKey('Indomaret'), 'indomaret');
});

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅  Semua ${passed} assertion lulus.`);
} else {
  console.log(`❌  ${failed} gagal, ${passed} lulus dari ${passed + failed} assertion.`);
  process.exit(1);
}
