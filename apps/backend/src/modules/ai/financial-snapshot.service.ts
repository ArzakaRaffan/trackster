import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BalanceService } from '../balance/balance.service';
import { BudgetService } from '../budget/budget.service';
import { GoalService } from '../goal/goal.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { HabitService } from '../habit/habit.service';
import { periodWords } from '../budget/budget-period';
import { wibDateKey, wibRange } from '../../common/wib';
import { sumSpend } from '../../common/spend';

const CACHE_MS = 5 * 60_000;
// Sama semangatnya dengan threshold di ai-anomaly.service.ts: heuristik sederhana, bukan model
// statistik proper — angka tetap di atas rata-rata pengeluaran harian Arzaka.
const BIG_PURCHASE_THRESHOLD = 500_000;

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

function fmtRp(n: number): string {
  return `Rp${Math.round(n).toLocaleString('id-ID')}`;
}

function fmtDateShort(d: Date): string {
  const { year, month, day } = (() => {
    const key = wibDateKey(d);
    const [y, m, dd] = key.split('-').map(Number);
    return { year: y, month: m, day: dd };
  })();
  return `${day} ${MONTH_LABELS[month - 1]}`;
}

function fmtDayLong(d: Date): string {
  const key = wibDateKey(d);
  const [y, m, dd] = key.split('-').map(Number);
  const dow = new Date(`${key}T00:00:00Z`).getUTCDay();
  return `${DAY_LABELS[dow]}, ${dd} ${MONTH_LABELS[m - 1]} ${y}`;
}

/**
 * Teks ringkas kondisi keuangan Arzaka HARI INI — disuntik ke system prompt tiap chat (blok [2]).
 * Deterministik penuh, nggak ada panggilan AI di sini; cache 5 menit karena dipanggil tiap pesan.
 */
@Injectable()
export class FinancialSnapshotService {
  // Cache PER USER — satu cache global akan menyajikan snapshot user A ke user B.
  private cache = new Map<number, { text: string; expiresAt: number }>();

  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
    private budgetService: BudgetService,
    private goalService: GoalService,
    private subscriptionService: SubscriptionService,
    private habitService: HabitService,
  ) {}

  async getSnapshot(userId: number, force = false): Promise<string> {
    const hit = this.cache.get(userId);
    if (!force && hit && hit.expiresAt > Date.now()) return hit.text;
    const text = await this.buildSnapshot(userId);
    this.cache.set(userId, { text, expiresAt: Date.now() + CACHE_MS });
    return text;
  }

  private async buildSnapshot(userId: number): Promise<string> {
    const now = new Date();
    const { start: weekStart, end: weekEnd } = wibRange('week', now);
    const { start: dayStart, end: dayEnd } = wibRange('day', now);

    const [
      balances,
      todaySummary,
      bigPurchases,
      goals,
      upcomingSubs,
      habits,
      pendingIncomeCount,
    ] = await Promise.all([
      this.balanceService.getAll(userId),
      this.budgetService.getTodaySummary(userId),
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: new Date(now.getTime() - 30 * 86_400_000) }, amount: { gte: BIG_PURCHASE_THRESHOLD } },
        orderBy: { amount: 'desc' },
        take: 3,
      }),
      this.goalService.findAll(userId),
      this.subscriptionService.getUpcomingReminders(userId, 14),
      this.habitService.getWeekly(userId),
      this.prisma.income.count({ where: { userId, status: 'PENDING' } }),
    ]);

    const lines: string[] = [];

    lines.push(`Hari ini: ${fmtDayLong(now)} (WIB). Minggu berjalan: ${fmtDateShort(weekStart)}–${fmtDateShort(new Date(weekEnd.getTime() - 86_400_000))}.`);

    const balanceParts = await Promise.all(
      balances.map(async (b) => {
        const adjustments = await this.balanceService.getAdjustments(userId, b.source);
        const lastAdj = adjustments[0];
        return `${b.source} ${fmtRp(Number(b.balance))}${lastAdj ? ` (koreksi manual terakhir ${fmtDateShort(lastAdj.createdAt)})` : ''}`;
      }),
    );
    lines.push(`Saldo: ${balanceParts.join(' · ')}.`);

    const c = todaySummary.cycle;
    const w = periodWords(c);
    const basisTxt = c.basis === 'INCOME'
      ? `ikut pemasukan (pemasukan dihitung ${fmtRp(c.income)}, disisihkan ${c.reservePct}% = ${fmtRp(c.reserve)})`
      : `target sendiri ${fmtRp(c.target ?? 0)}${c.targetIsUsual ? ' (= belanja rutin biasanya)' : ''}`;
    lines.push(
      `Budget ${w.label} (${c.start}–${c.end}, ${c.period === 'WEEKLY' ? 'mingguan' : 'bulanan'}): ${fmtRp(c.periodBudget)}, ${basisTxt}` +
        `${c.carry ? `, sisa periode lalu +${fmtRp(c.carry)}` : ''}${c.commitments ? `, langganan mendatang −${fmtRp(c.commitments)}` : ''}. ` +
        `Sisa ${fmtRp(c.remaining - todaySummary.totalSpent)} untuk ${c.daysLeft} hari (${w.until})${c.deficit ? ' — DEFISIT' : ''}. ` +
        `Hari ini ${fmtRp(todaySummary.totalSpent)} / jatah ${fmtRp(todaySummary.budget)}.`,
    );

    if (bigPurchases.length > 0) {
      const parts = bigPurchases.map((t) => `${t.description} ${fmtRp(Number(t.amount))} (${fmtDateShort(t.occurredAt)})`);
      lines.push(`Pembelian besar 30 hari: ${parts.join(', ')}.`);
    }

    const pastiTxt = c.pasti.map((p) =>
      `${p.name} biasanya ${fmtRp(p.usual)}${p.learned ? ' (dari kebiasaan)' : ' (angka yang diisi)'}${p.receivedCount ? `, sudah masuk ${fmtRp(p.received)}` : p.paydays ? ', belum masuk' : ''}`);
    lines.push(
      `Pemasukan ${w.label}: ${pastiTxt.length ? `pasti — ${pastiTxt.join('; ')}` : 'tidak ada pemasukan pasti'}; tambahan ${fmtRp(c.tambahan)}.` +
        (c.pastiPending.length ? ` Lewat jadwal & belum tercatat: ${c.pastiPending.map((p) => p.name).join(', ')}.` : '') +
        (habits.income?.usualTotal != null ? ` Biasanya total ${fmtRp(habits.income.usualTotal)} per periode.` : ''),
    );
    if (habits.learning) {
      lines.push(`Kebiasaan: masih kenalan (${habits.learning.weeksObserved} dari ${habits.learning.needed} minggu riwayat).`);
    } else {
      lines.push(
        `Kebiasaan: belanja rutin biasanya ${fmtRp(habits.spending.usualWeekly ?? 0)}/minggu, minggu ini ${fmtRp(habits.spending.thisWeek)}.` +
          (habits.insights.length ? ` ${habits.insights.map((x) => x.textId).join(' ')}` : ''),
      );
    }

    if (goals.length > 0) {
      const parts = goals.map(
        (g) =>
          `${g.name} ${fmtRp(g.currentAmount)}/${fmtRp(Number(g.targetAmount))}` +
          (g.targetDate ? `, target ${fmtDateShort(g.targetDate)}` : ', tanpa deadline'),
      );
      lines.push(`Goal: ${parts.join(' · ')}.`);
    }

    if (upcomingSubs.length > 0) {
      // getUpcomingReminders() serialize() nextDueDate jadi string "YYYY-MM-DD" (buat konsumen API) —
      // fmtDateShort butuh Date asli, konversi balik di sini.
      const parts = upcomingSubs.map((s) => `${s.name} ${fmtRp(Number(s.amount))} (${fmtDateShort(new Date(s.nextDueDate))})`);
      lines.push(`Langganan 14 hari ke depan: ${parts.join(', ')}.`);
    }

    if (pendingIncomeCount > 0) {
      lines.push(`Catatan data: ${pendingIncomeCount} pemasukan PENDING belum dikonfirmasi (halaman Pemasukan).`);
    }

    return lines.join('\n');
  }
}
