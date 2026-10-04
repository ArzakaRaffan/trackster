import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChatChannel } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AiService, ChatMessage as AiMessage } from './ai.service';
import { AiFinanceToolsService } from './ai-finance-tools.service';
import { FinancialSnapshotService } from './financial-snapshot.service';
import { AiMemoryService, parseMemoryOps } from './ai-memory.service';
import { RetrievalService } from './retrieval.service';
import { wibDateKey } from '../../common/wib';

const MEMORY_EXTRACTION_SYSTEM_PROMPT = `Kamu mengekstrak fakta tahan lama tentang Arzaka dari satu giliran percakapan finansial.

Hanya simpan: rencana, preferensi, kekhawatiran, profil, atau keputusan yang akan tetap relevan di percakapan berikutnya.
JANGAN simpan angka yang sudah ada di database (saldo, total belanja, budget) — itu sudah otomatis disuntik ke prompt tiap kali.
Kalau ada memory yang mirip di daftar "Memory aktif saat ini", UPDATE itu (jangan bikin duplikat baru).
Maksimal 3 operasi. Kalau tidak ada fakta baru yang layak disimpan, balas array kosong [].

Balas HANYA JSON array, tanpa teks lain, format:
[{"op":"add","kind":"GOAL"|"PLAN"|"PREFERENCE"|"CONCERN"|"PROFILE"|"EVENT"|"DECISION","content":"kalimat orang ketiga","importance":1-3,"validUntil":"YYYY-MM-DD (opsional, cuma buat EVENT/PLAN bertanggal)"}]
atau {"op":"update","id":123,"content":"..."} atau {"op":"archive","id":123}`;

// E04-S5: persona konsultan, ganti dari "financial buddy" generik (E04-S1..S4) ke alur konsultasi
// yang lebih tegas.
const FINANCIAL_ADVISOR_SYSTEM_PROMPT = `Kamu adalah Track — konsultan keuangan pribadi Arzaka (mahasiswa, pemasukan mingguan dari beberapa sumber yang nggak selalu tetap: les privat, magang, uang mingguan keluarga, Ruangguru, project sampingan). Bukan chatbot generik yang cuma jawab data, dan bukan penceramah yang menggurui.

ALUR JAWAB untuk masalah/keputusan (mau beli sesuatu, atur budget, kejar goal, lagi bokek, dst):
1. Pahami dulu — kalau BENAR-BENAR perlu, tanya maksimal SATU hal klarifikasi paling penting (jangan berondong pertanyaan sebelum ngasih apa-apa).
2. Cek data nyata dulu lewat tool (snapshot, forecast, transaksi, simulasi) — jangan menjawab dari asumsi.
3. Diagnosis singkat 1-2 kalimat: apa yang sebenarnya sedang terjadi.
4. Kasih 2-3 opsi dengan angka konkret dan trade-off yang jelas — bukan cuma "bisa aja sih, tergantung".
5. Rekomendasi TEGAS — kamu konsultan, bukan cuma menyerahkan pilihan mentah-mentah ke Arzaka.
6. Satu langkah konkret yang bisa dikerjakan MINGGU INI.
7. Kalau relevan, tawarkan simulasi lanjutan (tool simulatePlan/whatIfPurchase), bikin goal (proposeGoal), atau pengingat.

Pertanyaan faktual sederhana (saldo, sisa budget hari ini, dll) → jawab langsung singkat, SKIP alur di atas.

ATURAN KERAS:
- Angka finansial HANYA dari tool — JANGAN PERNAH menghitung/mengarang/mengasumsikan total, rata-rata, atau proyeksi sendiri.
- Kalau data belum lengkap (income belum check-in minggu ini, ada pemasukan PENDING, dll), bilang JUJUR itu memengaruhi keakuratan jawaban — jangan pura-pura yakin.
- Kalau Arzaka bilang SUDAH beli/bayar/ngeluarin sesuatu (pernyataan, bukan pertanyaan) → langsung logExpense, konfirmasi singkat apa yang dicatat.
- Pakai memory & percakapan lama secara NATURAL dalam kalimat ("kemarin kamu bilang lagi nabung buat laptop…") — jangan dibacakan semua kayak daftar checklist.
- Bahasa Indonesia santai, ringkas by default. Kalau topiknya besar/butuh detail panjang, tawarkan dulu "mau versi detail?" daripada langsung menjelaskan panjang lebar.
- Jangan menceramahi ("kurangi jajan", "harus hemat") tanpa data konkret yang menunjukkan itu memang masalahnya.`;

// Jumlah pesan (user + balasan akhir assistant, tool call diexclude) yang dikirim ulang sebagai
// history mentah. Lebih dari ini, sisa lama diringkas ke ChatThread.summary.
const WINDOW_SIZE = 20;
const SUMMARIZE_THRESHOLD = WINDOW_SIZE + 10;

// Filter Prisma: cuma pesan yang relevan buat dikirim ulang ke model — user, atau assistant yang
// sudah final (ada content). Assistant "stub" yang cuma berisi tool_calls sengaja dibuang dari
// history karena tool response pasangannya tidak diresend (sudah tercermin di balasan akhir).
const HISTORY_FILTER = {
  OR: [{ role: 'user' }, { role: 'assistant', NOT: { content: '' } }],
};

/** Dari pesan baru hasil satu putaran tool loop, ambil teks balasan akhir yang layak ditampilkan
 *  ke user — assistant message terakhir yang punya content (skip stub tool_calls tanpa content). */
export function extractFinalReply(messages: AiMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant' && m.content) return m.content;
  }
  return undefined;
}

function findLastAssistantWithContentIndex(messages: AiMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && messages[i].content) return i;
  }
  return -1;
}

/** Tool (E04-S4) yang hasilnya punya `card` (simulasi, usulan goal, dst) — dikumpulkan dari
 * semua tool call satu giliran, ditempel ke pesan assistant final biar frontend bisa render.
 * Tool result = untrusted-ish (JSON dari handler kita sendiri, tapi tetap parse defensif). */
function extractCards(messages: AiMessage[]): Record<string, unknown>[] {
  const cards: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.role !== 'tool' || !m.content) continue;
    try {
      const parsed = JSON.parse(m.content);
      if (parsed && typeof parsed === 'object' && parsed.card) cards.push(parsed.card);
    } catch {
      // tool content bukan JSON valid — skip diam-diam, tidak fatal buat balasan.
    }
  }
  return cards;
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private aiFinanceToolsService: AiFinanceToolsService,
    private financialSnapshotService: FinancialSnapshotService,
    private aiMemoryService: AiMemoryService,
    private retrievalService: RetrievalService,
  ) {}

  listThreads(channel?: ChatChannel) {
    return this.prisma.chatThread.findMany({
      where: channel ? { channel } : undefined,
      orderBy: { updatedAt: 'desc' },
    });
  }

  createThread(channel: ChatChannel = ChatChannel.WEB) {
    return this.prisma.chatThread.create({ data: { channel } });
  }

  async updateThread(id: number, data: { title?: string; archived?: boolean }) {
    await this.assertThreadExists(id);
    return this.prisma.chatThread.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.archived !== undefined ? { archivedAt: data.archived ? new Date() : null } : {}),
      },
    });
  }

  async deleteThread(id: number) {
    await this.assertThreadExists(id);
    await this.prisma.chatThread.delete({ where: { id } });
  }

  async getMessages(threadId: number) {
    await this.assertThreadExists(threadId);
    return this.prisma.chatMessage.findMany({
      where: { threadId, ...HISTORY_FILTER },
      orderBy: { id: 'asc' },
    });
  }

  /** Thread "Quick chat" tunggal dipakai POST /ai/chat lama, sampai frontend pindah ke thread UI. */
  async getOrCreateQuickChatThread() {
    const existing = await this.prisma.chatThread.findFirst({
      where: { channel: ChatChannel.WEB, title: 'Quick chat', archivedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;
    return this.prisma.chatThread.create({
      data: { channel: ChatChannel.WEB, title: 'Quick chat' },
    });
  }

  /** Satu thread persisten per channel Telegram — semua pesan bot masuk ke sini. */
  async getOrCreateTelegramThread() {
    const existing = await this.prisma.chatThread.findFirst({
      where: { channel: ChatChannel.TELEGRAM, archivedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.chatThread.create({
      data: { channel: ChatChannel.TELEGRAM, title: 'Telegram' },
    });
  }

  /** Kirim pesan user ke thread, jalanin tool loop, simpan semua pesan baru, return balasan akhir. */
  async sendMessage(
    threadId: number,
    text: string,
    stream?: { onToken: (text: string) => void; onToolRound: () => void },
  ): Promise<string> {
    const thread = await this.assertThreadExists(threadId);
    this.logger.log(`sendMessage thread=${threadId}: ${text.slice(0, 100)}`);

    await this.prisma.chatMessage.create({
      data: { threadId, role: 'user', content: text },
    });

    try {
      const history = await this.prisma.chatMessage.findMany({
        where: { threadId, ...HISTORY_FILTER },
        orderBy: { id: 'desc' },
        take: WINDOW_SIZE,
      });
      history.reverse();

      // Pesan tertua di window sudah masuk history mentah di bawah — retrieval tidak perlu
      // menyarankan balik pesan yang sama, cukup ekor panjang di luar window ini.
      const excludeAfterId = history.length > 0 ? history[0].id - 1 : 0;

      const [snapshot, activeMemories, retrieved] = await Promise.all([
        this.financialSnapshotService.getSnapshot(),
        this.aiMemoryService.listActive(),
        this.retrievalService.search(text, { excludeThreadId: threadId, excludeAfterId }),
      ]);
      const memoryBlock = this.aiMemoryService.formatForPrompt(activeMemories);
      const retrievalBlock = this.retrievalService.formatForPrompt(retrieved);

      const system = [
        FINANCIAL_ADVISOR_SYSTEM_PROMPT,
        `\nKondisi keuangan Arzaka saat ini:\n${snapshot}`,
        memoryBlock
          ? `\nYang kamu tau tentang Arzaka dari percakapan sebelumnya (konteks, bukan angka presisi — tetap pakai tool buat angka):\n${memoryBlock}`
          : '',
        retrievalBlock
          ? `\nPercakapan/laporan lama yang mungkin relevan (rujuk kalau memang nyambung, jangan dipaksakan):\n${retrievalBlock}`
          : '',
        thread.summary ? `\nRingkasan percakapan lama dengan Arzaka di thread ini:\n${thread.summary}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const aiMessages: AiMessage[] = history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const newMessages = await this.aiService.runToolLoop({
        system,
        messages: aiMessages,
        tools: this.aiFinanceToolsService.getTools({ threadId, excludeAfterId }),
        maxTokens: 1024,
        onToken: stream?.onToken,
        onToolRound: stream?.onToolRound,
      });

      const cards = extractCards(newMessages);
      const lastAssistantIdx = findLastAssistantWithContentIndex(newMessages);

      for (let i = 0; i < newMessages.length; i++) {
        const m = newMessages[i];
        await this.prisma.chatMessage.create({
          data: {
            threadId,
            role: m.role,
            content: m.content ?? '',
            toolCalls: m.tool_calls ? (m.tool_calls as any) : undefined,
            toolCallId: m.tool_call_id,
            toolName: m.name,
            // Kartu (grafik simulasi, usulan goal, dst) dari tool di giliran ini ikut ditempel
            // ke pesan assistant FINAL — bukan tiap stub tool_calls — biar frontend cuma perlu
            // render attachments dari satu pesan per giliran (E04-S4).
            attachments: i === lastAssistantIdx && cards.length > 0 ? (cards as any) : undefined,
          },
        });
      }

      const reply = extractFinalReply(newMessages);

      await this.prisma.chatThread.update({
        where: { id: threadId },
        data: {
          updatedAt: new Date(),
          ...(thread.title ? {} : { title: await this.generateTitle(text) }),
        },
      });

      this.maybeSummarize(threadId).catch((err) =>
        this.logger.warn(`Summarize thread ${threadId} gagal: ${err?.message}`),
      );

      if (reply) {
        this.extractMemory(text, reply).catch((err) => this.logger.warn(`Ekstraksi memory gagal: ${err?.message}`));
      }

      return reply || 'Maaf, ada gangguan teknis. Coba lagi ya!';
    } catch (err: any) {
      this.logger.error(`sendMessage error: ${err?.message}`, err?.stack);
      const fallback = 'Waduh, ada error nih. Coba beberapa saat lagi ya!';
      await this.prisma.chatMessage.create({
        data: { threadId, role: 'assistant', content: fallback },
      });
      return fallback;
    }
  }

  private async generateTitle(firstMessage: string): Promise<string> {
    try {
      const res = await this.aiService.chat({
        system: 'Buat judul singkat (maks 5 kata, tanpa tanda kutip) untuk percakapan finansial yang dibuka dengan pesan user berikut.',
        model: 'fast',
        messages: [{ role: 'user', content: firstMessage }],
        maxTokens: 20,
      });
      const title = (res?.content ?? '').trim().replace(/^["']|["']$/g, '');
      return title || firstMessage.slice(0, 40);
    } catch {
      return firstMessage.slice(0, 40);
    }
  }

  private async maybeSummarize(threadId: number) {
    const total = await this.prisma.chatMessage.count({ where: { threadId, ...HISTORY_FILTER } });
    if (total <= SUMMARIZE_THRESHOLD) return;

    const toSummarize = await this.prisma.chatMessage.findMany({
      where: { threadId, ...HISTORY_FILTER },
      orderBy: { id: 'asc' },
      take: total - WINDOW_SIZE,
    });
    if (toSummarize.length === 0) return;

    const thread = await this.prisma.chatThread.findUnique({ where: { id: threadId } });
    const transcript = toSummarize.map((m) => `${m.role}: ${m.content}`).join('\n');
    const prompt = `${thread?.summary ? `Ringkasan sebelumnya:\n${thread.summary}\n\n` : ''}Percakapan tambahan:\n${transcript}`;

    const res = await this.aiService.chat({
      system: 'Ringkas percakapan finansial berikut jadi maksimal 5 kalimat, orang ketiga, fokus fakta/rencana/preferensi penting — bukan basa-basi.',
      model: 'fast',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 300,
    });
    const summary = (res?.content ?? '').trim();
    if (!summary) return;

    await this.prisma.chatThread.update({
      where: { id: threadId },
      data: { summary, summaryUpToId: toSummarize[toSummarize.length - 1].id },
    });
  }

  /** Async, fire-and-forget (dipanggil tanpa await dari sendMessage) — TIDAK boleh throw ke atas.
   *  Model AI_MODEL_FAST diminta ekstrak fakta tahan lama dari satu giliran, hasil JSON divalidasi
   *  ketat oleh parseMemoryOps sebelum diterapkan (output model = untrusted input). */
  private async extractMemory(userText: string, assistantReply: string): Promise<void> {
    const activeMemories = await this.aiMemoryService.listActive();
    const memoryList =
      activeMemories.length > 0
        ? activeMemories.map((m) => `id=${m.id} [${m.kind}] ${m.content}`).join('\n')
        : '(belum ada)';
    // Model AI_MODEL_FAST nggak tau "hari ini" tanpa diberitahu — kalau nggak dikasih tanggal
    // eksplisit, dia nebak validUntil pakai tahun training data-nya (kejadian nyata: nulis 2024
    // buat "sebelum Desember" pas tahun berjalan sudah 2026), yang bikin listActive() langsung
    // ngarsipin memory itu di panggilan berikutnya karena dianggap "sudah lewat" (lihat
    // listActive() di ai-memory.service.ts). Ditemukan di eval manual E04-S5 dengan AI asli.
    const prompt = `Hari ini: ${wibDateKey(new Date())}.\n\nMemory aktif saat ini:\n${memoryList}\n\nPesan user: ${userText}\nBalasan asisten: ${assistantReply}`;

    const res = await this.aiService.chat({
      system: MEMORY_EXTRACTION_SYSTEM_PROMPT,
      model: 'fast',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 400,
    });
    const ops = parseMemoryOps(res?.content ?? '[]');
    if (ops.length > 0) await this.aiMemoryService.applyOps(ops);
  }

  private async assertThreadExists(id: number) {
    const thread = await this.prisma.chatThread.findUnique({ where: { id } });
    if (!thread) throw new NotFoundException(`Thread ${id} tidak ditemukan`);
    return thread;
  }

  /** Legacy: satu pesan tanpa thread eksplisit (dipakai sebelum E04-S1). Dipertahankan untuk
   *  compatibility internal — pemanggil baru sebaiknya pakai sendMessage(threadId, text). */
  async handleMessage(text: string, ctx: { channel: 'web' | 'telegram' }): Promise<string> {
    const thread =
      ctx.channel === 'telegram'
        ? await this.getOrCreateTelegramThread()
        : await this.getOrCreateQuickChatThread();
    return this.sendMessage(thread.id, text);
  }

  /** Kategorisasi otomatis untuk transaksi dari email sync.
   *  TIDAK throw — kalau gagal, fallback ke LAINNYA dan log warning. */
  async categorize(
    description: string,
    amount: number,
  ): Promise<string> {
    const validCategories = [
      'MAKANAN', 'TRANSPORT', 'BELANJA', 'TAGIHAN', 'HIBURAN', 'KESEHATAN', 'LAINNYA',
      'TRANSFER', 'TOPUP', 'PENDIDIKAN', 'PERAWATAN', 'INVESTASI', 'ROKOK',
    ];

    const systemPrompt = `Kamu adalah kategorisasi otomatis transaksi keuangan.
Kategorikan transaksi berikut ke salah satu kategori ini SAJA: ${validCategories.join(', ')}.
Jawab HANYA dengan nama kategori (huruf kapital semua), tanpa teks lain apapun.`;

    try {
      const response = await this.aiService.chat({
        system: systemPrompt,
        model: 'fast',
        messages: [
          {
            role: 'user',
            content: `Deskripsi: "${description}", Jumlah: Rp ${amount.toLocaleString('id-ID')}`,
          },
        ],
        maxTokens: 20,
      });

      const raw = (response?.content ?? '').trim().toUpperCase();
      if (validCategories.includes(raw)) {
        return raw;
      }

      this.logger.warn(`Kategorisasi AI return nilai tidak valid: "${raw}", fallback LAINNYA`);
      return 'LAINNYA';
    } catch (err: any) {
      this.logger.warn(`Kategorisasi gagal (${err?.message}), fallback LAINNYA`);
      return 'LAINNYA';
    }
  }
}
