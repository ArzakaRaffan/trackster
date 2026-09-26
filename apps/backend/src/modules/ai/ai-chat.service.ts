import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChatChannel } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AiService, ChatMessage as AiMessage } from './ai.service';
import { AiFinanceToolsService } from './ai-finance-tools.service';

const FINANCIAL_ADVISOR_SYSTEM_PROMPT = `Kamu adalah Trackster AI — financial buddy personal untuk Arzaka.

Tugasmu: bantu Arzaka memahami kondisi keuangannya, kasih saran konkret, dan catat pengeluaran yang dia sebutkan.

ATURAN PENTING:
1. SELALU panggil tool untuk data finansial apapun — JANGAN pernah mengarang atau mengasumsikan angka.
2. Jawab dalam Bahasa Indonesia yang santai dan natural, seperti teman yang peduli soal keuangan.
3. Kalau Arzaka bilang habis beli/bayar/ngeluarin sesuatu (bukan nanya), LANGSUNG pakai tool logExpense untuk catat, lalu konfirmasi apa yang dicatat.
4. Kalau ditanya soal kondisi keuangan, panggil tool yang relevan dulu baru jawab berdasarkan data nyata.
5. Jangan panjang-panjang — jawab ringkas, to the point, kasih insight yang actionable.
6. Kalau data tidak ada atau periode tidak cocok, bilang jujur — jangan karangan.

Kamu bisa bantu:
- Jawab pertanyaan keuangan (pengeluaran hari ini, minggu ini, bulan tertentu, dll)
- Kasih analisis pola pengeluaran
- Saran sebelum beli sesuatu (pre-purchase advice)
- Catat pengeluaran manual yang disebutkan via chat
- Kasih motivasi finansial yang realistis berdasarkan data nyata`;

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

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private aiFinanceToolsService: AiFinanceToolsService,
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
  async sendMessage(threadId: number, text: string): Promise<string> {
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

      const system = thread.summary
        ? `${FINANCIAL_ADVISOR_SYSTEM_PROMPT}\n\nRingkasan percakapan lama dengan Arzaka di thread ini:\n${thread.summary}`
        : FINANCIAL_ADVISOR_SYSTEM_PROMPT;

      const aiMessages: AiMessage[] = history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const newMessages = await this.aiService.runToolLoop({
        system,
        messages: aiMessages,
        tools: this.aiFinanceToolsService.getTools(),
        maxTokens: 1024,
      });

      for (const m of newMessages) {
        await this.prisma.chatMessage.create({
          data: {
            threadId,
            role: m.role,
            content: m.content ?? '',
            toolCalls: m.tool_calls ? (m.tool_calls as any) : undefined,
            toolCallId: m.tool_call_id,
            toolName: m.name,
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

      return reply || 'Maaf, ada gangguan teknis. Coba lagi ya!';
    } catch (err: any) {
      this.logger.error(`sendMessage error: ${err?.message}`);
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
