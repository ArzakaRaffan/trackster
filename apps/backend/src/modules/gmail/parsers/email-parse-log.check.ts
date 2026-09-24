/**
 * email-parse-log.check.ts — self-check untuk aturan upsert EmailParseLog (E00-S2)
 * Jalankan dengan: npx ts-node src/modules/gmail/parsers/email-parse-log.check.ts
 */
import * as assert from 'assert';
import { ParseStatus } from '@prisma/client';
import { shouldSkipLogUpsert } from './email-parse-log.util';

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

console.log('\n── shouldSkipLogUpsert ──');

check('belum ada log (null) → jangan skip', () => {
  assert.strictEqual(shouldSkipLogUpsert(null), false);
});

check('sudah RECORDED → skip (jangan ketimpa jadi DUPLICATE dst)', () => {
  assert.strictEqual(shouldSkipLogUpsert(ParseStatus.RECORDED), true);
});

check('sudah UNPARSED → jangan skip (boleh ketimpa kalau parser baru berhasil)', () => {
  assert.strictEqual(shouldSkipLogUpsert(ParseStatus.UNPARSED), false);
});

check('sudah DUPLICATE → jangan skip', () => {
  assert.strictEqual(shouldSkipLogUpsert(ParseStatus.DUPLICATE), false);
});

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅  Semua ${passed} assertion lulus.`);
} else {
  console.log(`❌  ${failed} gagal, ${passed} lulus dari ${passed + failed} assertion.`);
  process.exit(1);
}
