import { Injectable, Logger } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AiService } from './ai.service';
import { TelegramService } from '../telegram/telegram.service';

const ANOMALY_SYSTEM_PROMPT = `Kamu adalah Trackster AI. Arzaka baru dapat transaksi yang jauh di atas kebiasaannya. Tulis SATU pesan Telegram singkat (maks 3 kalimat, Bahasa Indonesia santai) yang: 1) sebut transaksinya & seberapa di atas rata-rata biasanya, 2) tanya konfirmasi santai (bukan interogasi/menghakimi) apakah ini disengaja/wajar. Jangan pakai emoji lebih dari 2.`;

export interface CheckableTransaction {
  id: number;
  description: string;
  amount: number;
  category: Category;
  merchantKey: string | null;
  occurredAt: Date;
}

// ponytail: threshold statistik sederhana (avg×2.5 + selisih absolut minimal), bukan model deteksi
// anomali proper (mis. IQR/z-score musiman) — upgrade kalau mulai banyak false positive/negative.
const MULTIPLIER_THRESHOLD = 2.5;
const MIN_ABSOLUTE_DIFF = 50_000;
const MIN_BASELINE_SAMPLES = 3;

@Injectable()
export class AiAnomalyService {
  private readonly logger = new Logger(AiAnomalyService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private telegramService: TelegramService,
  ) {}

  /** Fire-and-forget dari gmail-sync setelah transaksi baru tercatat. Deteksi murni statistik
   *  (rata-rata merchant/kategori 90 hari) — AI cuma dipanggil buat narasi KALAU memang anomali,
   *  supaya tidak ada "anomali" yang sebenarnya cuma halusinasi model. */
  async checkAndNotify(userId: number, transaction: CheckableTransaction): Promise<void> {
    try {
      const baseline = await this.getBaseline(userId, transaction);
      if (!baseline || baseline.count < MIN_BASELINE_SAMPLES) return;

      const isAnomaly =
        transaction.amount > baseline.avg * MULTIPLIER_THRESHOLD &&
        transaction.amount - baseline.avg > MIN_ABSOLUTE_DIFF;
      if (!isAnomaly) return;

      const message = await this.aiService.chat({
        system: ANOMALY_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              transaksi: {
                deskripsi: transaction.description,
                jumlah: transaction.amount,
                kategori: transaction.category,
              },
              rataRataBiasanya: Math.round(baseline.avg),
              jumlahTransaksiHistoris: baseline.count,
            }),
          },
        ],
        maxTokens: 150,
      });

      const text = message?.content?.trim();
      if (!text) return;

      await this.telegramService.sendMessage(userId, `🔍 <b>Kok gede ya?</b>\n\n${text}`);
    } catch (err: any) {
      this.logger.warn(`Anomaly check gagal utk transaksi ${transaction.id}: ${err?.message}`);
    }
  }

  private async getBaseline(userId: number, transaction: CheckableTransaction) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const where = transaction.merchantKey
      ? {
          userId,
          merchantKey: transaction.merchantKey,
          occurredAt: { gte: ninetyDaysAgo },
          id: { not: transaction.id },
        }
      : {
          userId,
          category: transaction.category,
          occurredAt: { gte: ninetyDaysAgo },
          id: { not: transaction.id },
        };

    // tenancy-ok: `where` dibangun di atas dengan userId
    const agg = await this.prisma.transaction.aggregate({
      where,
      _avg: { amount: true },
      _count: true,
    });
    if (!agg._count) return null;
    return { avg: Number(agg._avg.amount ?? 0), count: agg._count };
  }
}
