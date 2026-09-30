import * as assert from 'assert';
import { settle, MemberBalance } from './settle';

function runChecks() {
  console.log('Running settle checks...');

  // 1. Nol hutang-piutang → tidak ada transfer
  assert.deepStrictEqual(
    settle([
      { memberId: 1, name: 'A', net: 0 },
      { memberId: 2, name: 'B', net: 0 },
    ]),
    []
  );

  // 2. Satu transfer langsung: A bayar B
  const r2 = settle([
    { memberId: 1, name: 'A', net: -50000 },
    { memberId: 2, name: 'B', net: 50000 },
  ]);
  assert.strictEqual(r2.length, 1);
  assert.deepStrictEqual(r2[0], { fromMemberId: 1, fromName: 'A', toMemberId: 2, toName: 'B', amount: 50000 });

  // 3. Tiga anggota, dua bayar ke satu penerima (2 transfer = n-1)
  const r3 = settle([
    { memberId: 1, name: 'A', net: -30000 },
    { memberId: 2, name: 'B', net: -20000 },
    { memberId: 3, name: 'C', net: 50000 },
  ]);
  assert.strictEqual(r3.length, 2);
  assert.strictEqual(r3.reduce((s, t) => s + t.amount, 0), 50000);
  // Setiap transfer harus ke C
  assert.ok(r3.every((t) => t.toMemberId === 3));

  // 4. Kasus klasik 4 orang (A bayar 210 untuk 4 orang → hutang B/C/D masing-masing 52.5
  //    dibulatkan). Ini cuma smoke test: jumlah transfer harus <= n-1 dan bersihkan semua saldo.
  const balances: MemberBalance[] = [
    { memberId: 1, name: 'A', net: -52500 },
    { memberId: 2, name: 'B', net: -52500 },
    { memberId: 3, name: 'C', net: -52500 },
    { memberId: 4, name: 'D', net: 157500 },
  ];
  const r4 = settle(balances);
  assert.ok(r4.length > 0 && r4.length <= 3);
  assert.strictEqual(r4.reduce((s, t) => s + t.amount, 0), 157500);
  assert.ok(r4.every((t) => t.toMemberId === 4));

  // 5. Dua debitur, dua kreditur: greedy terbesar-ke-terbesar menutup satu pihak per
  //    iterasi → maks n-1 = 3 transfer, dan total yang berpindah = total piutang.
  const r5 = settle([
    { memberId: 1, name: 'A', net: -100000 },
    { memberId: 2, name: 'B', net: -100000 },
    { memberId: 3, name: 'C', net: 50000 },
    { memberId: 4, name: 'D', net: 150000 },
  ]);
  assert.strictEqual(r5.reduce((s, t) => s + t.amount, 0), 200000);
  assert.ok(r5.length <= 3, `transfer ${r5.length} > n-1`);
  // Setiap transfer harus valid: pengirim beda dari penerima.
  assert.ok(r5.every((t) => t.fromMemberId !== t.toMemberId));

  console.log('All checks passed!');
}

runChecks();
