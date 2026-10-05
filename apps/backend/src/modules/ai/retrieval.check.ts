/**
 * retrieval.check.ts — self-check RetrievalService (E04-S3), butuh DB (dev DB, port 5434).
 * Insert pesan sungguhan, query, assert, lalu bersihkan data yang dibuat sendiri.
 * Jalankan dengan: npx ts-node src/modules/ai/retrieval.check.ts
 */
import * as assert from 'assert';
import { PrismaService } from '../../prisma.service';
import { RetrievalService } from './retrieval.service';

let passed = 0;
let failed = 0;

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e: any) {
    console.error(`  ❌ ${label}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

async function main() {
  const prisma = new PrismaService();
  const retrieval = new RetrievalService(prisma);

  // Dua user uji: A (pemilik data yang dicari) dan B (tak boleh melihat/dilihat A) — isolasi tenant (multi-user F2).
  const stamp = Date.now();
  const userA = await prisma.user.create({ data: { username: `retrieval_a_${stamp}`, password: 'x' } });
  const userB = await prisma.user.create({ data: { username: `retrieval_b_${stamp}`, password: 'x' } });
  const thread = await prisma.chatThread.create({ data: { userId: userA.id, title: 'Retrieval check' } });
  const other = await prisma.chatThread.create({ data: { userId: userA.id, title: 'Thread lain' } });
  const threadB = await prisma.chatThread.create({ data: { userId: userB.id, title: 'Thread milik B' } });
  const msgB = await prisma.chatMessage.create({
    data: { threadId: threadB.id, role: 'user', content: 'Rahasia B: aku ditabung dan tabungan laptop B' },
  });

  const oldMsg = await prisma.chatMessage.create({
    data: { threadId: thread.id, role: 'user', content: 'Aku mau bikin tabungan buat laptop baru' },
  });
  const otherMsg = await prisma.chatMessage.create({
    data: { threadId: other.id, role: 'assistant', content: 'Oke, coba ditabung pelan-pelan aja' },
  });
  const windowedMsg = await prisma.chatMessage.create({
    data: { threadId: thread.id, role: 'user', content: 'Progress tabungan minggu ini lumayan lah' },
  });

  console.log('\n── RetrievalService.search ──');

  // "ditabung" & "tabungan" stem ke root berbeda dari "menabung"/"nabung" di dictionary
  // 'indonesian' bawaan Postgres (lihat Gotchas.md) — pasangan ini yang beneran ke-stem sama.
  await check('stemming: query "ditabung" ketemu pesan yang nulis "tabungan"', async () => {
    const results = await retrieval.search(userA.id, 'ditabung', { limit: 10 });
    assert.ok(results.some((r) => r.id === oldMsg.id), 'pesan lama tidak ketemu');
    assert.ok(results.some((r) => r.id === otherMsg.id), 'pesan thread lain tidak ketemu');
  });

  await check('excludeThreadId + excludeAfterId: pesan di window thread aktif dikecualikan', async () => {
    const results = await retrieval.search(userA.id, 'ditabung', {
      excludeThreadId: thread.id,
      excludeAfterId: oldMsg.id, // windowedMsg (id > oldMsg.id) dianggap sudah di window
      limit: 10,
    });
    assert.ok(!results.some((r) => r.id === windowedMsg.id), 'pesan dalam window seharusnya dikecualikan');
    assert.ok(results.some((r) => r.id === oldMsg.id), 'pesan di luar window (thread sama) harus tetap muncul');
    assert.ok(results.some((r) => r.id === otherMsg.id), 'pesan thread lain harus tetap muncul');
  });

  await check('query tanpa hasil → array kosong, formatForPrompt → string kosong', async () => {
    const results = await retrieval.search(userA.id, 'katakedaikatasebutankeempatpuluhtujuh');
    assert.deepStrictEqual(results, []);
    assert.strictEqual(retrieval.formatForPrompt(results), '');
  });

  await check('snippet dari ts_headline masuk formatForPrompt dengan judul thread', async () => {
    const results = await retrieval.search(userA.id, 'laptop', { limit: 5 });
    const block = retrieval.formatForPrompt(results);
    assert.ok(block.includes('Retrieval check'), 'judul thread harus muncul di blok prompt');
  });

  await check('ISOLASI: user A tidak pernah menerima pesan user B (dan sebaliknya)', async () => {
    const asA = await retrieval.search(userA.id, 'ditabung', { limit: 50 });
    assert.ok(!asA.some((r) => r.id === msgB.id), 'pesan B bocor ke A');
    assert.ok(asA.every((r) => r.threadId !== threadB.id), 'thread B bocor ke A');
    const asB = await retrieval.search(userB.id, 'ditabung', { limit: 50 });
    assert.ok(asB.some((r) => r.id === msgB.id), 'B harus menemukan pesannya sendiri');
    assert.ok(!asB.some((r) => [oldMsg.id, otherMsg.id, windowedMsg.id].includes(r.id)), 'pesan A bocor ke B');
  });

  const threadIds = [thread.id, other.id, threadB.id];
  await prisma.chatMessage.deleteMany({ where: { threadId: { in: threadIds } } });
  await prisma.chatThread.deleteMany({ where: { id: { in: threadIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.$disconnect();

  console.log(`\n${'─'.repeat(50)}`);
  if (failed === 0) {
    console.log(`✅  Semua ${passed} assertion lulus.`);
  } else {
    console.log(`❌  ${failed} gagal, ${passed} lulus dari ${passed + failed} assertion.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('retrieval.check.ts crash:', err);
  process.exit(1);
});
