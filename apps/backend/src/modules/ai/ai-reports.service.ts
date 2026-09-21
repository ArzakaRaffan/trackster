import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { AiService } from './ai.service';
import { TransactionService } from '../transaction/transaction.service';
import { TelegramService } from '../telegram/telegram.service';

const WEEKLY_NARRATIVE_PROMPT = `Kamu adalah Trackster AI — financial buddy personal Arzaka.
Tugas: Tulis ringkasan mingguan keuangan Arzaka dalam Bahasa Indonesia yang santai.

Format laporan:
1. Satu paragraf pola pengeluaran minggu ini (jujur, tidak menghakimi)
2. Maksimal 3 rekomendasi konkret dan spesifik (bukan saran generik)
3. Satu kalimat opportunity-cost dari merchant terbesar: "Uang yang kamu habiskan di [merchant] selama sebulan setara dengan [analogi menarik]"

Jangan panjang-panjang. Gunakan angka nyata dari data yang diberikan. Tidak perlu salam pembuka/penutup formal.`;

const HEALTH_SCORE_COMMENTARY_PROMPT = `Kamu adalah Trackster AI. Berikan 1 kalimat reaksi manusiawi dan jujur terhadap Financial Health Score berikut.
Jangan terlalu positif kalau skor rendah, tapi tetap konstruktif. Maks 20 kata. Bahasa Indonesia santai.`;

const MONTHLY_REPORT_PROMPT = `Kamu adalah Trackster AI — financial buddy personal Arzaka.
Tugas: Tulis report card bulanan keuangan Arzaka dalam Bahasa Indonesia yang santai.

Format:
1. Satu kalimat verdict bulan ini (jujur)
2. 2-3 highlight: apa yang bagus, apa yang perlu diperbaiki
3. Satu target konkret untuk bulan depan

Gunakan angka nyata dari data. Tidak perlu salam pembuka/penutup formal. Singkat dan actionable.`;

@Injectable()
export class AiReportsService {
  private readonly logger = new Logger(AiReportsService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private transactionService: TransactionService,
    private telegramService: TelegramService,
  ) {}

  /** Weekly: setiap Minggu jam 20:00 WIB */
  @Cron('0 20 * * 0', { name: 'weekly-insight-report', timeZone: 'Asia/Jakarta' })
  async sendWeeklyInsight() {
    this.logger.log('Mengirim Weekly Insight Report...');
    try {
      const insights = await this.transactionService.getInsights('30d');

      const narrative = await this.aiService.chat({
        system: WEEKLY_NARRATIVE_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(insights) }],
        maxTokens: 512,
      });

      const text = narrative?.content ?? '';
      if (text) {
        await this.telegramService.sendMessage(`📊 <b>Weekly Financial Report</b>\n\n${text}`);
      }

      // Hitung & simpan Health Score sekalian
      await this.computeAndSaveHealthScore(insights);
    } catch (err: any) {
      this.logger.error(`sendWeeklyInsight error: ${err?.message}`);
    }
  }

  /** Monthly: cek setiap hari jam 20:00 WIB, eksekusi kalau hari ini = hari terakhir bulan */
  @Cron('0 20 * * *', { name: 'monthly-report-card', timeZone: 'Asia/Jakarta' })
  async sendMonthlyReportCard() {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (now.getDate() !== lastDay) return; // bukan akhir bulan

    this.logger.log('Mengirim Monthly Report Card...');
    try {
      const monthly = await this.transactionService.getMonthly(
        now.getFullYear(),
        now.getMonth() + 1,
      );
      const allTime = await this.transactionService.getAllTimeSummary();

      const narrative = await this.aiService.chat({
        system: MONTHLY_REPORT_PROMPT,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({ monthly, allTime }),
          },
        ],
        maxTokens: 512,
      });

      const text = narrative?.content ?? '';
      if (text) {
        const monthName = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        await this.telegramService.sendMessage(
          `📅 <b>Report Card ${monthName}</b>\n\n${text}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`sendMonthlyReportCard error: ${err?.message}`);
    }
  }

  /** Hitung Health Score algoritmik + simpan ke HealthScoreLog */
  async computeAndSaveHealthScore(insights?: any) {
    try {
      const data = insights ?? (await this.transactionService.getInsights('30d'));

      // budgetAdherencePct: 100 - percentageOverBudget (clamp 0-100)
      const overBudgetPct = Number(data?.budgetAdherence?.percentageOverBudget ?? 50);
      const budgetAdherencePct = Math.max(0, Math.min(100, 100 - overBudgetPct));

      // savingsRatePct: (totalIncome - totalSpent) / totalIncome * 100 (30 hari terakhir)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [incomeAgg, spentAgg] = await Promise.all([
        this.prisma.income.aggregate({
          _sum: { amount: true },
          where: { receivedAt: { gte: thirtyDaysAgo } },
        }),
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { occurredAt: { gte: thirtyDaysAgo } },
        }),
      ]);

      const totalIncome = Number(incomeAgg._sum.amount ?? 0);
      const totalSpent = Number(spentAgg._sum.amount ?? 0);

      let savingsRatePct = 0;
      if (totalIncome > 0) {
        savingsRatePct = Math.max(0, Math.min(100, ((totalIncome - totalSpent) / totalIncome) * 100));
      }

      // Score: budget adherence 60% weight, savings rate 40%
      // Bobot ini bisa di-tuning — budget discipline > savings rate karena income tidak selalu kontrolnya Arzaka
      const score = Math.round(budgetAdherencePct * 0.6 + savingsRatePct * 0.4);

      // AI commentary — 1 kalimat, opsional (jangan fail skor kalau ini gagal)
      let aiCommentary: string | null = null;
      try {
        const commentaryRes = await this.aiService.chat({
          system: HEALTH_SCORE_COMMENTARY_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Score: ${score}/100. Budget adherence: ${budgetAdherencePct.toFixed(1)}%. Savings rate: ${savingsRatePct.toFixed(1)}%.`,
            },
          ],
          maxTokens: 60,
        });
        aiCommentary = commentaryRes?.content ?? null;
      } catch {
        // Ignore commentary error — skor tetap tersimpan
      }

      // weekStart = Senin minggu ini
      const weekStart = new Date(now);
      const dayOfWeek = now.getDay(); // 0=Minggu
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(now.getDate() + diffToMonday);
      weekStart.setHours(0, 0, 0, 0);

      await this.prisma.healthScoreLog.upsert({
        where: { weekStart },
        update: { score, budgetAdherencePct, savingsRatePct, aiCommentary },
        create: { weekStart, score, budgetAdherencePct, savingsRatePct, aiCommentary },
      });

      this.logger.log(`HealthScore saved: ${score}/100 (week ${weekStart.toISOString().slice(0, 10)})`);
      return { score, budgetAdherencePct, savingsRatePct, aiCommentary };
    } catch (err: any) {
      this.logger.error(`computeAndSaveHealthScore error: ${err?.message}`);
      return null;
    }
  }
}
