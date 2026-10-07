import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportPeriod } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AiService } from './ai.service';
import { TelegramService } from '../telegram/telegram.service';
import { BudgetService } from '../budget/budget.service';
import { GoalService } from '../goal/goal.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ReportService } from '../report/report.service';
import { forEachActiveUser } from '../../common/per-user';
import { addWibDays, isLastWibDayOfMonth, startOfWibDay, startOfWibWeek, wibDateKey, wibRange } from '../../common/wib';
import { forUser, getUserName } from '../../common/persona';

const HEALTH_SCORE_COMMENTARY_PROMPT = `Kamu adalah Trackster AI. Berikan 1 kalimat reaksi manusiawi dan jujur terhadap Financial Health Score berikut.
Jangan terlalu positif kalau skor rendah, tapi tetap konstruktif. Maks 20 kata. Bahasa Indonesia santai.`;

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
    private telegramService: TelegramService,
    private budgetService: BudgetService,
    private goalService: GoalService,
    private subscriptionService: SubscriptionService,
    private analyticsService: AnalyticsService,
    private reportService: ReportService,
  ) {}

  /** Daily: setiap hari jam 22:00 WIB. Skip kalau nggak ada aktivitas hari ini — jangan spam
   *  recap kosong. */
  @Cron('0 22 * * *', { name: 'daily-recap', timeZone: 'Asia/Jakarta' })
  async dailyRecapCron() {
    await forEachActiveUser(this.prisma, this.logger, 'daily-recap', (userId) => this.sendDailyRecap(userId), { jitterMs: 30_000 });
  }

  async sendDailyRecap(userId: number) {
    this.logger.log(`Mengirim Daily Recap (user ${userId})...`);
    try {
      const today = await this.budgetService.getTodaySummary(userId);
      if (today.totalSpent === 0 && today.totalIncome === 0) return; // nggak ada aktivitas, skip

      const narrative = await this.aiService.chat({
        system: forUser(DAILY_RECAP_PROMPT, await getUserName(this.prisma, userId)),
        messages: [{ role: 'user', content: JSON.stringify(today) }],
        maxTokens: 150,
        model: 'fast',
      });

      const text = narrative?.content?.trim();
      if (text) {
        await this.telegramService.sendMessage(userId, `🌙 <b>Recap Hari Ini</b>\n\n${text}`);
      }
    } catch (err: any) {
      this.logger.error(`sendDailyRecap error: ${err?.message}`);
    }
  }

  /** Weekly: setiap Senin jam 07:10 WIB (setelah weekly-insight-report) — nudge progres goal. */
  @Cron('10 7 * * 1', { name: 'weekly-goal-nudge', timeZone: 'Asia/Jakarta' })
  async goalNudgeCron() {
    await forEachActiveUser(this.prisma, this.logger, 'weekly-goal-nudge', (userId) => this.sendGoalNudge(userId), { jitterMs: 30_000 });
  }

  async sendGoalNudge(userId: number) {
    this.logger.log(`Mengirim Goal Nudge (user ${userId})...`);
    try {
      const goals = await this.goalService.findAll(userId);
      if (!goals.length) return;

      const narrative = await this.aiService.chat({
        system: forUser(GOAL_NUDGE_PROMPT, await getUserName(this.prisma, userId)),
        messages: [{ role: 'user', content: JSON.stringify(goals) }],
        maxTokens: 250,
      });

      const text = narrative?.content?.trim();
      if (text) {
        await this.telegramService.sendMessage(userId, `🎯 <b>Progres Goal</b>\n\n${text}`);
      }
    } catch (err: any) {
      this.logger.error(`sendGoalNudge error: ${err?.message}`);
    }
  }

  /** Monthly: cek setiap hari jam 20:30 WIB, eksekusi kalau hari ini = hari terakhir bulan
   *  (offset dari monthly-report-card biar nggak numpuk di jam yang sama). */
  @Cron('30 20 * * *', { name: 'monthly-subscription-review', timeZone: 'Asia/Jakarta' })
  async subscriptionReviewCron() {
    if (!isLastWibDayOfMonth(new Date())) return;
    await forEachActiveUser(this.prisma, this.logger, 'monthly-subscription-review', (userId) => this.sendSubscriptionReview(userId), { jitterMs: 30_000 });
  }

  async sendSubscriptionReview(userId: number) {
    this.logger.log(`Mengirim Subscription Review (user ${userId})...`);
    try {
      const subs = await this.subscriptionService.findAll(userId);
      const active = subs.filter((s) => s.isActive);
      if (!active.length) return;

      const totalMonthly = active.reduce(
        (sum, s) => sum + (s.cycle === 'YEARLY' ? s.amount / 12 : s.amount),
        0,
      );

      const possibleDuplicates = this.findSimilarNames(active.map((s) => s.name));

      const narrative = await this.aiService.chat({
        system: forUser(SUBSCRIPTION_REVIEW_PROMPT, await getUserName(this.prisma, userId)),
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
        await this.telegramService.sendMessage(userId, `📦 <b>Review Langganan</b>\n\n${text}`);
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

  private async existedBy(userId: number, at: Date): Promise<boolean> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    return !!u && u.createdAt <= at;
  }

  /** Tutup minggu lalu (Senin-Minggu) → hitung PeriodStats + narasi, simpan snapshot `PeriodReport`.
   *  Jalan sebelum `weekly-insight-report` biar narasinya udah siap pas dikirim. */
  @Cron('0 6 * * 1', { name: 'close-weekly-report', timeZone: 'Asia/Jakarta' })
  async closeWeeklyReportCron() {
    await forEachActiveUser(this.prisma, this.logger, 'close-weekly-report', (userId) => this.closeWeeklyReport(userId), { jitterMs: 30_000 });
  }

  async closeWeeklyReport(userId: number) {
    this.logger.log(`Menutup laporan mingguan (user ${userId})...`);
    try {
      const anchor = this.reportService.lastClosedWeekAnchor(new Date());
      const { start, end } = wibRange('week', anchor);
      if (!(await this.existedBy(userId, end))) return; // user baru: jangan bikin laporan kosong utk periode sebelum ia ada
      await this.reportService.closePeriod(userId, ReportPeriod.WEEK, start, end);
    } catch (err: any) {
      this.logger.error(`closeWeeklyReport error: ${err?.message}`);
    }
  }

  /** Tutup bulan lalu → sama seperti di atas, buat bulan kalender. */
  @Cron('30 6 1 * *', { name: 'close-monthly-report', timeZone: 'Asia/Jakarta' })
  async closeMonthlyReportCron() {
    await forEachActiveUser(this.prisma, this.logger, 'close-monthly-report', (userId) => this.closeMonthlyReport(userId), { jitterMs: 30_000 });
  }

  async closeMonthlyReport(userId: number) {
    this.logger.log(`Menutup laporan bulanan (user ${userId})...`);
    try {
      const anchor = this.reportService.lastClosedMonthAnchor(new Date());
      const { start, end } = wibRange('month', anchor);
      if (!(await this.existedBy(userId, end))) return; // user baru: jangan bikin laporan kosong utk periode sebelum ia ada
      await this.reportService.closePeriod(userId, ReportPeriod.MONTH, start, end);
    } catch (err: any) {
      this.logger.error(`closeMonthlyReport error: ${err?.message}`);
    }
  }

  /** Weekly: setiap Senin jam 07:00 WIB — kirim narasi tersimpan (minggu Senin-Minggu yang baru tutup). */
  @Cron('0 7 * * 1', { name: 'weekly-insight-report', timeZone: 'Asia/Jakarta' })
  async weeklyInsightCron() {
    await forEachActiveUser(this.prisma, this.logger, 'weekly-insight-report', (userId) => this.sendWeeklyInsight(userId), { jitterMs: 30_000 });
  }

  async sendWeeklyInsight(userId: number) {
    this.logger.log(`Mengirim Weekly Insight Report (user ${userId})...`);
    try {
      const anchor = this.reportService.lastClosedWeekAnchor(new Date());
      const report = await this.reportService.getReport(userId, 'week', anchor);
      if (report.narrative) {
        const link = `${this.frontendUrl()}/app/reports?period=week&date=${wibDateKey(new Date(report.start))}`;
        await this.telegramService.sendMessage(
          userId,
          `📊 <b>Laporan Minggu Ini</b>\n\n${report.narrative}\n\n<a href="${link}">Lihat detail</a>`,
        );
      }

      // Hitung & simpan Health Score sekalian
      await this.computeAndSaveHealthScore(userId);
    } catch (err: any) {
      this.logger.error(`sendWeeklyInsight error: ${err?.message}`);
    }
  }

  /** Monthly: setiap tanggal 1 jam 07:00 WIB — kirim narasi tersimpan (bulan lalu yang baru tutup). */
  @Cron('0 7 1 * *', { name: 'monthly-report-card', timeZone: 'Asia/Jakarta' })
  async monthlyReportCardCron() {
    await forEachActiveUser(this.prisma, this.logger, 'monthly-report-card', (userId) => this.sendMonthlyReportCard(userId), { jitterMs: 30_000 });
  }

  async sendMonthlyReportCard(userId: number) {
    this.logger.log(`Mengirim Monthly Report Card (user ${userId})...`);
    try {
      const anchor = this.reportService.lastClosedMonthAnchor(new Date());
      const report = await this.reportService.getReport(userId, 'month', anchor);
      if (report.narrative) {
        const monthName = new Date(report.start).toLocaleDateString('id-ID', {
          month: 'long',
          year: 'numeric',
          timeZone: 'Asia/Jakarta',
        });
        const link = `${this.frontendUrl()}/app/reports?period=month&date=${wibDateKey(new Date(report.start))}`;
        await this.telegramService.sendMessage(
          userId,
          `📅 <b>Report Card ${monthName}</b>\n\n${report.narrative}\n\n<a href="${link}">Lihat detail</a>`,
        );
      }
    } catch (err: any) {
      this.logger.error(`sendMonthlyReportCard error: ${err?.message}`);
    }
  }

  private frontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  /** Hitung Health Score algoritmik (dari PeriodStats 30 hari) + simpan ke HealthScoreLog */
  async computeAndSaveHealthScore(userId: number) {
    try {
      const now = new Date();
      const end = addWibDays(startOfWibDay(now), 1);
      const stats = await this.analyticsService.getPeriodStats(userId, addWibDays(end, -30), end, false);

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

      // findFirst + update/create (bukan upsert): unik masih global (weekStart) sampai C1 -> (userId, weekStart).
      const existingLog = await this.prisma.healthScoreLog.findFirst({ where: { userId, weekStart }, select: { id: true } });
      if (existingLog) {
        await this.prisma.healthScoreLog.updateMany({
          where: { id: existingLog.id, userId },
          data: { score, budgetAdherencePct, savingsRatePct, aiCommentary },
        });
      } else {
        await this.prisma.healthScoreLog.create({ data: { userId, weekStart, score, budgetAdherencePct, savingsRatePct, aiCommentary } });
      }

      this.logger.log(`HealthScore saved: ${score}/100 (week ${wibDateKey(weekStart)})`);
      return { score, budgetAdherencePct, savingsRatePct, aiCommentary };
    } catch (err: any) {
      this.logger.error(`computeAndSaveHealthScore error: ${err?.message}`);
      return null;
    }
  }
}
