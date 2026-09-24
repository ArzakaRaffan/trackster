import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
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

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private aiService: AiService,
    private aiFinanceToolsService: AiFinanceToolsService,
  ) {}

  async handleMessage(
    text: string,
    ctx: { channel: 'web' | 'telegram' },
  ): Promise<string> {
    this.logger.log(`handleMessage [${ctx.channel}]: ${text.slice(0, 100)}`);

    try {
      const reply = await this.aiService.runToolLoop({
        system: FINANCIAL_ADVISOR_SYSTEM_PROMPT,
        userMessage: text,
        tools: this.aiFinanceToolsService.getTools(),
        maxTokens: 1024,
      });
      return reply || 'Maaf, ada gangguan teknis. Coba lagi ya!';
    } catch (err: any) {
      this.logger.error(`handleMessage error: ${err?.message}`);
      return 'Waduh, ada error nih. Coba beberapa saat lagi ya!';
    }
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
