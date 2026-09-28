import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { AiService } from './ai.service';
import { TransactionService } from '../transaction/transaction.service';
import { TelegramService } from '../telegram/telegram.service';
import { BudgetService } from '../budget/budget.service';
import { GoalService } from '../goal/goal.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { addWibDays, isLastWibDayOfMonth, startOfWibDay, startOfWibWeek, wibDateKey, wibParts } from '../../common/wib';

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

const DAILY_RECAP_PROMPT = `Kamu adalah Trackster AI — financial buddy personal Arzaka.
Tugas: Tulis recap SANGAT SINGKAT (maks 2 kalimat) soal hari ini, Bahasa Indonesia santai.
Sebut satu hal konkret dari data (transaksi terbesar/kategori dominan/status budget), bukan generik.
Kalau hari ini nggak ada apa-apa istimewa, boleh santai/jenaka. Tidak perlu salam pembuka/penutup formal.`;

const GOAL_NUDGE_PROMPT = `Kamu adalah Trackster AI — financial buddy personal Arzaka.
Tugas: Tulis SATU pesan singkat (maks 3 kalimat) soal progres goal tabungan Arzaka minggu ini, Bahasa Indonesia santai.
Sebut goal yang paling butuh perhatian (paling jauh dari target/deadline terdekat), kasih angka konkret
berapa yang perlu ditabung per minggu buat kejar. Jujur kalau progresnya nggak realistis, tapi tetap suportif.
Tidak perlu salam pembuka/penutup formal.`;

const SUBSCRIPTION_REVIEW_PROMPT = `Kamu adalah Trackster AI — financial buddy personal Arzaka.
Tugas: Tulis review bulanan langganan (subscription) Arzaka, Bahasa Indonesia santai, maks 4 kalimat.
Sebut total biaya bulanan semua langganan aktif, dan kalau ada nama yang terdengar mirip/duplikat
(dari data yang diberikan), tanya apakah masih kepake semua. Jangan mengarang langganan yang tidak ada di data.
Tidak perlu salam pembuka/penutup formal.`;

@Injectable()
export class AiReportsService {
  private readonly logger = new Logger(AiReportsService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private transactionService: TransactionService,
    private telegramService: TelegramService,
    private budgetService: BudgetService,
    private goalService: GoalService,
    private subscriptionService: SubscriptionService,
    private analyticsService: AnalyticsService,
  ) {}

  /** Daily: setiap hari jam 22:00 WIB. Skip kalau nggak ada aktivitas hari ini — jangan spam
   *  recap kosong. */
  @Cron('0 22 * * *', { name: 'daily-recap', timeZone: 'Asia/Jakarta' })
  async sendDailyRecap() {
    this.logger.log('Mengirim Daily Recap...');
    try {
      const today = await this.budgetService.getTodaySummary();
      if (today.totalSpent === 0 && today.totalIncome === 0) return; // nggak ada aktivitas, skip

      const narrative = await this.aiService.chat({
        system: DAILY_RECAP_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(today) }],
        maxTokens: 150,
        model: 'fast',
      });

      const text = narrative?.content?.trim();
      if (text) {
        await this.telegramService.sendMessage(`🌙 <b>Recap Hari Ini</b>\n\n${text}`);
      }
    } catch (err: any) {
      this.logger.error(`sendDailyRecap error: ${err?.message}`);
    }
  }

  /** Weekly: setiap Minggu jam 20:10 WIB (setelah weekly-insight-report) — nudge progres goal. */
  @Cron('10 20 * * 0', { name: 'weekly-goal-nudge', timeZone: 'Asia/Jakarta' })
  async sendGoalNudge() {
    this.logger.log('Mengirim Goal Nudge...');
    try {
      const goals = await this.goalService.findAll();
      if (!goals.length) return;

      const narrative = await this.aiService.chat({
        system: GOAL_NUDGE_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(goals) }],
        maxTokens: 250,
      });

      const text = narrative?.content?.trim();
      if (text) {
        await this.telegramService.sendMessage(`🎯 <b>Progres Goal</b>\n\n${text}`);
      }
    } catch (err: any) {
      this.logger.error(`sendGoalNudge error: ${err?.message}`);
    }
  }

  /** Monthly: cek setiap hari jam 20:30 WIB, eksekusi kalau hari ini = hari terakhir bulan
   *  (offset dari monthly-report-card biar nggak numpuk di jam yang sama). */
  @Cron('30 20 * * *', { name: 'monthly-subscription-review', timeZone: 'Asia/Jakarta' })
  async sendSubscriptionReview() {
    const now = new Date();
    if (!isLastWibDayOfMonth(now)) return;

    this.logger.log('Mengirim Subscription Review...');
    try {
      const subs = await this.subscriptionService.findAll();
      const active = subs.filter((s) => s.isActive);
      if (!active.length) return;

      const totalMonthly = active.reduce(
        (sum, s) => sum + (s.cycle === 'YEARLY' ? s.amount / 12 : s.amount),
        0,
      );

      const possibleDuplicates = this.findSimilarNames(active.map((s) => s.name));

      const narrative = await this.aiService.chat({
        system: SUBSCRIPTION_REVIEW_PROMPT,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              langganan: active.map((s) => ({ nama: s.name, jumlah: s.amount, siklus: s.cycle })),
              totalBulanan: Math.round(totalMonthly),
              kemungkinanDuplikat: possibleDuplicates,
            }),
          },
        ],
        maxTokens: 300,
      });

      const text = narrative?.content?.trim();
      if (text) {
        await this.telegramService.sendMessage(`📦 <b>Review Langganan</b>\n\n${text}`);
      }
    } catch (err: any) {
      this.logger.error(`sendSubscriptionReview error: ${err?.message}`);
    }
  }

  /** Heuristik sederhana: nama langganan yang berbagi kata pertama (lowercase) — cukup buat
   *  nangkep "Netflix" vs "Netflix Premium", tidak buat typo/sinonim. */
  private findSimilarNames(names: string[]): string[][] {
    const groups = new Map<string, string[]>();
    for (const name of names) {
      const key = name.trim().toLowerCase().split(/\s+/)[0];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(name);
    }
    return [...groups.values()].filter((g) => g.length > 1);
  }

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
      await this.computeAndSaveHealthScore();
    } catch (err: any) {
      this.logger.error(`sendWeeklyInsight error: ${err?.message}`);
    }
  }

  /** Monthly: cek setiap hari jam 20:00 WIB, eksekusi kalau hari ini = hari terakhir bulan */
  @Cron('0 20 * * *', { name: 'monthly-report-card', timeZone: 'Asia/Jakarta' })
  async sendMonthlyReportCard() {
    const now = new Date();
    if (!isLastWibDayOfMonth(now)) return; // bukan akhir bulan (WIB)

    this.logger.log('Mengirim Monthly Report Card...');
    try {
      const { year, month } = wibParts(now);
      const monthly = await this.transactionService.getMonthly(year, month);
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
        const monthName = now.toLocaleDateString('id-ID', {
          month: 'long',
          year: 'numeric',
          timeZone: 'Asia/Jakarta',
        });
        await this.telegramService.sendMessage(
          `📅 <b>Report Card ${monthName}</b>\n\n${text}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`sendMonthlyReportCard error: ${err?.message}`);
    }
  }

  /** Hitung Health Score algoritmik (dari PeriodStats 30 hari) + simpan ke HealthScoreLog */
  async computeAndSaveHealthScore() {
    try {
      const now = new Date();
      const end = addWibDays(startOfWibDay(now), 1);
      const stats = await this.analyticsService.getPeriodStats(addWibDays(end, -30), end, false);

      // budgetAdherencePct: langsung dari PeriodStats (null kalau nggak ada hari berbudget di periode ini)
      const budgetAdherencePct = Math.max(0, Math.min(100, stats.budget.adherencePct ?? 50));

      // savingsRatePct: dari PeriodStats juga (null kalau income 0)
      const savingsRatePct = Math.max(0, Math.min(100, stats.totals.savingsRate ?? 0));

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

      // weekStart = Senin minggu ini (WIB)
      const weekStart = startOfWibWeek(now);

      await this.prisma.healthScoreLog.upsert({
        where: { weekStart },
        update: { score, budgetAdherencePct, savingsRatePct, aiCommentary },
        create: { weekStart, score, budgetAdherencePct, savingsRatePct, aiCommentary },
      });

      this.logger.log(`HealthScore saved: ${score}/100 (week ${wibDateKey(weekStart)})`);
      return { score, budgetAdherencePct, savingsRatePct, aiCommentary };
    } catch (err: any) {
      this.logger.error(`computeAndSaveHealthScore error: ${err?.message}`);
      return null;
    }
  }
}
