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

  const thread = await prisma.chatThread.create({ data: { title: 'Retrieval check' } });
  const other = await prisma.chatThread.create({ data: { title: 'Thread lain' } });

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
    const results = await retrieval.search('ditabung', { limit: 10 });
    assert.ok(results.some((r) => r.id === oldMsg.id), 'pesan lama tidak ketemu');
    assert.ok(results.some((r) => r.id === otherMsg.id), 'pesan thread lain tidak ketemu');
  });

  await check('excludeThreadId + excludeAfterId: pesan di window thread aktif dikecualikan', async () => {
    const results = await retrieval.search('ditabung', {
      excludeThreadId: thread.id,
      excludeAfterId: oldMsg.id, // windowedMsg (id > oldMsg.id) dianggap sudah di window
      limit: 10,
    });
    assert.ok(!results.some((r) => r.id === windowedMsg.id), 'pesan dalam window seharusnya dikecualikan');
    assert.ok(results.some((r) => r.id === oldMsg.id), 'pesan di luar window (thread sama) harus tetap muncul');
    assert.ok(results.some((r) => r.id === otherMsg.id), 'pesan thread lain harus tetap muncul');
  });

  await check('query tanpa hasil → array kosong, formatForPrompt → string kosong', async () => {
    const results = await retrieval.search('katakedaikatasebutankeempatpuluhtujuh');
    assert.deepStrictEqual(results, []);
    assert.strictEqual(retrieval.formatForPrompt(results), '');
  });

  await check('snippet dari ts_headline masuk formatForPrompt dengan judul thread', async () => {
    const results = await retrieval.search('laptop', { limit: 5 });
    const block = retrieval.formatForPrompt(results);
    assert.ok(block.includes('Retrieval check'), 'judul thread harus muncul di blok prompt');
  });

  await prisma.chatMessage.deleteMany({ where: { threadId: { in: [thread.id, other.id] } } });
  await prisma.chatThread.deleteMany({ where: { id: { in: [thread.id, other.id] } } });
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
