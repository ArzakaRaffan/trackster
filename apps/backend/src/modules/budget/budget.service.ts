import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BudgetBasis, BudgetMode, BudgetPeriod, IncomeCadence, IncomeKind, IncomeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { UpdateBudgetSettingsDto } from './dto/update-budget-settings.dto';
import {
  activeStyle, AnchorSchedule, BudgetOption, computePeriodAllowance, cycleBounds, learnedWeights, normalizeWeights, pastiPart,
  paydayDates, PeriodAllowanceInput, periodSchedule, previousPeriods, RESERVE_PCT, round500, stylePreviews, TARGET_FACTOR, usualAmount,
} from './budget-period';
import { calcStreamForecast } from '../income-forecast/income-forecast.service';
import { bigPurchaseThreshold, isBigPurchase, median } from '../analytics/period-stats.util';
import { forEachActiveUser } from '../../common/per-user';
import { MerchantAliasService } from '../merchant-alias/merchant-alias.service';
import { addWibDays, startOfWibDay, startOfWibWeek, wibDateKey, wibRange } from '../../common/wib';
import { spend, sumSpend } from '../../common/spend';
import { commitmentsBetween } from '../subscription/subscription-due';
import { spendBaseline } from '../habit/habit-engine';

export interface BudgetSettings {
  rolloverEnabled: boolean;
  reservePct: number;
  period: BudgetPeriod;
  periodDay: number;
  basis: BudgetBasis;
  targetAmount: number | null;
  autoWeights: boolean;
  anchorStreamId: number | null;
  /** Setelan lama yang belum ditinjau (period masih null) → diturunkan otomatis, UI menampilkan banner. */
  needsReview: boolean;
}

type IncomeStreamRow = Awaited<ReturnType<PrismaService['incomeStream']['findMany']>>[number];

/** Pemasukan pasti = stream rutin aktif (mingguan/bulanan), bukan "tak tentu". Jenis lama (sesi/potongan/variabel) ikut
 * dihitung sebagai pasti; nominalnya dipelajari dari kebiasaan. */
export const isPastiStream = (s: Pick<IncomeStreamRow, 'isActive' | 'cadence' | 'kind'>) =>
  s.isActive && (s.cadence === IncomeCadence.WEEKLY || s.cadence === IncomeCadence.MONTHLY) && s.kind !== IncomeKind.IRREGULAR;

const streamSchedule = (s: Pick<IncomeStreamRow, 'cadence' | 'payDayOfWeek' | 'payDayOfMonth'>): AnchorSchedule => ({
  cadence: s.cadence === IncomeCadence.MONTHLY ? 'MONTHLY' : 'WEEKLY',
  payDayOfWeek: s.payDayOfWeek,
  payDayOfMonth: s.payDayOfMonth,
});

/** Nominal yang diisi user untuk satu stream (dipakai sebelum ada ≥3 pembayaran). */
export function declaredAmount(s: IncomeStreamRow): number {
  if (s.kind === IncomeKind.FIXED) return Number(s.amount ?? 0);
  const n = (v: unknown) => (v == null ? null : Number(v));
  return calcStreamForecast(
    {
      kind: s.kind, cadence: s.cadence, amount: n(s.amount), sessionRate: n(s.sessionRate), sessionExtra: n(s.sessionExtra),
      maxUnits: s.maxUnits, deductionPerUnit: n(s.deductionPerUnit), typicalUnits: n(s.typicalUnits),
    },
    { historicalAmounts: [], historicalAbsences: [], isScheduledThisWeek: true },
  ).expected;
}

const PERIOD_DAY_RANGE: Record<BudgetPeriod, [number, number]> = { WEEKLY: [0, 6], MONTHLY: [1, 31] };

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);

  constructor(
    private prisma: PrismaService,
    private merchantAliasService: MerchantAliasService,
  ) {}

  /** Nominal per hari — kini dipakai sebagai bobot hari kalau user memilih "atur sendiri" (`autoWeights=false`). */
  async getAll(userId: number) {
    return this.prisma.dailyBudget.findMany({ where: { userId }, orderBy: { dayOfWeek: 'asc' } });
  }

  async updateAll(userId: number, dto: UpdateBudgetDto) {
    // Unik sudah komposit (userId, dayOfWeek) → upsert; satu transaksi = 7 hari tersimpan semua atau tidak sama sekali.
    return this.prisma.$transaction(
      dto.budgets.map((item) =>
        this.prisma.dailyBudget.upsert({
          where: { userId_dayOfWeek: { userId, dayOfWeek: item.dayOfWeek } },
          create: { userId, dayOfWeek: item.dayOfWeek, amount: item.amount },
          update: { amount: item.amount },
        }),
      ),
    );
  }

  async getSettings(userId: number): Promise<BudgetSettings> {
    const s = await this.prisma.budgetSetting.findFirst({ where: { userId } });
    const common = {
      rolloverEnabled: s?.rolloverEnabled ?? false,
      reservePct: s?.reservePct ?? 10,
      anchorStreamId: s?.anchorStreamId ?? null,
      targetAmount: s?.targetAmount == null ? null : Number(s.targetAmount),
    };
    if (s?.period) {
      const [lo] = PERIOD_DAY_RANGE[s.period];
      return { ...common, period: s.period, periodDay: s.periodDay ?? Math.max(lo, 1), basis: s.basis, autoWeights: s.autoWeights, needsReview: false };
    }
    return { ...common, ...(await this.deriveLegacy(userId, s)), needsReview: true };
  }

  /** Setelan lama (mode FIXED/CYCLE/BALANCE) → setelan periode, tanpa menulis DB (keputusan Arzaka 2026-10-30: user lama
   * pindah otomatis + banner). Ikut gajian → ikut pemasukan; tetap/saldo → target mingguan mulai Senin. */
  private async deriveLegacy(userId: number, s: { mode: BudgetMode; anchorStreamId: number | null; targetAmount: unknown } | null) {
    if (s?.mode === BudgetMode.CYCLE && s.anchorStreamId != null) {
      const st = await this.prisma.incomeStream.findFirst({ where: { id: s.anchorStreamId, userId, isActive: true } });
      if (st && isPastiStream(st)) {
        const period = st.cadence === IncomeCadence.MONTHLY ? BudgetPeriod.MONTHLY : BudgetPeriod.WEEKLY;
        const periodDay = period === BudgetPeriod.WEEKLY ? st.payDayOfWeek ?? 1 : st.payDayOfMonth ?? 1;
        return { period, periodDay, basis: BudgetBasis.INCOME, autoWeights: true };
      }
    }
    const amounts = (await this.prisma.dailyBudget.findMany({ where: { userId }, select: { amount: true } })).map((r) => Number(r.amount));
    const uniform = amounts.every((a) => a === amounts[0]);
    const sum = amounts.reduce((t, a) => t + a, 0);
    return {
      period: BudgetPeriod.WEEKLY,
      periodDay: 1,
      basis: BudgetBasis.TARGET,
      // Mode saldo tidak punya angka mingguan → null = pakai belanja rutin biasanya.
      ...(s?.targetAmount == null ? { targetAmount: s?.mode === BudgetMode.BALANCE || !sum ? null : sum } : {}),
      autoWeights: uniform,
    };
  }

  async updateSettings(userId: number, dto: UpdateBudgetSettingsDto) {
    const current = await this.getSettings(userId);
    const patch = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) as Partial<UpdateBudgetSettingsDto>;
    const next = { ...current, ...patch };
    const [lo, hi] = PERIOD_DAY_RANGE[next.period];
    if (!Number.isInteger(next.periodDay) || next.periodDay < lo || next.periodDay > hi) {
      throw new BadRequestException(next.period === BudgetPeriod.WEEKLY ? 'periodDay mingguan harus 0..6' : 'periodDay bulanan harus 1..31');
    }
    if (next.anchorStreamId != null) {
      const stream = await this.prisma.incomeStream.findFirst({ where: { id: next.anchorStreamId, userId } });
      if (!stream || !isPastiStream(stream)) throw new BadRequestException('anchorStreamId harus pemasukan pasti (mingguan/bulanan) yang aktif');
    }
    const data = {
      period: next.period,
      periodDay: next.periodDay,
      basis: next.basis,
      targetAmount: next.targetAmount ?? null,
      reservePct: next.reservePct,
      autoWeights: next.autoWeights,
      rolloverEnabled: next.rolloverEnabled,
      anchorStreamId: next.anchorStreamId ?? null,
    };
    await this.persist(userId, data);
    return this.getSettings(userId);
  }

  private async persist(userId: number, data: Record<string, unknown>) {
    const existing = await this.prisma.budgetSetting.findFirst({ where: { userId }, select: { id: true } });
    if (existing) await this.prisma.budgetSetting.updateMany({ where: { id: existing.id, userId }, data });
    else await this.prisma.budgetSetting.create({ data: { userId, ...data } });
  }

  /** Gaya hemat/seimbang/longgar — langsung diterapkan. INCOME: sisihkan 15/10/5%. TARGET: 85/100/110% belanja rutin
   * biasanya. Tidak mengisi `period` (banner tinjau tetap ada sampai user menekan "Sudah benar"/menyimpan). */
  async applyStyle(userId: number, option: BudgetOption) {
    if (!Object.prototype.hasOwnProperty.call(RESERVE_PCT, option)) throw new BadRequestException('option harus hemat|seimbang|longgar');
    const settings = await this.getSettings(userId);
    if (settings.basis === BudgetBasis.INCOME) {
      await this.persist(userId, { reservePct: RESERVE_PCT[option] });
    } else {
      const usualSpend = (await this.getTodaySummary(userId)).cycle.usualSpend;
      if (!usualSpend) throw new BadRequestException('Belum cukup riwayat belanja untuk gaya ini — tentukan angkanya sendiri dulu');
      await this.persist(userId, { targetAmount: round500(usualSpend * TARGET_FACTOR[option]) });
    }
    return this.getTodaySummary(userId);
  }

  async getAllowances(userId: number, from: string, to: string) {
    const rows = await this.prisma.dailyAllowance.findMany({
      where: { userId, date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), amount: Number(r.amount) }));
  }

  /** 00:05 WIB — pastikan tiap hari punya snapshot DailyAllowance walau user tidak membuka app / tidak ada transaksi. */
  @Cron('5 0 * * *', { name: 'daily-allowance-snapshot', timeZone: 'Asia/Jakarta' })
  async dailyAllowanceSnapshotCron() {
    await forEachActiveUser(this.prisma, this.logger, 'daily-allowance-snapshot', (userId) => this.getTodaySummary(userId));
  }

  /** Budget periode berjalan (docs/budget-kebiasaan.md). Semua angka dihitung dari data — tidak ada yang disimpan selain
   * snapshot jatah harian. */
  private async computePeriod(userId: number, now: Date, s: BudgetSettings) {
    const todayStart = startOfWibDay(now);
    const todayEnd = addWibDays(todayStart, 1);
    const [user, firstTx, txs, streams, dailyRows, subs, balances] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
      this.prisma.transaction.findFirst({ where: { userId }, orderBy: { occurredAt: 'asc' }, select: { occurredAt: true } }),
      // 90 hari cukup untuk median "pembelian besar", 8 minggu kebiasaan, dan periode bulanan sebelumnya (carry).
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: addWibDays(todayEnd, -90), lt: todayEnd } },
        select: { amount: true, reimbursedAmount: true, occurredAt: true, isBig: true },
      }),
      this.prisma.incomeStream.findMany({ where: { userId, isActive: true } }),
      this.prisma.dailyBudget.findMany({ where: { userId } }),
      this.prisma.subscription.findMany({ where: { userId, isActive: true }, select: { amount: true, cycle: true, nextDueDate: true } }),
      this.prisma.bankBalance.findMany({ where: { userId }, select: { balance: true } }),
    ]);

    const median90 = median(txs.map(spend));
    const spentIn = (from: Date, to: Date) =>
      txs.filter((t) => t.occurredAt >= from && t.occurredAt < to).reduce((sum, t) => sum + spend(t), 0);

    // Data mulai = hari pertama memakai Trackster (akun dibuat) atau transaksi tertua kalau riwayat ikut tersinkron.
    const created = user?.createdAt ?? now;
    const dataStartsAt = firstTx && firstTx.occurredAt < created ? firstTx.occurredAt : created;
    const baseline = spendBaseline(
      txs.map((t) => ({ amount: spend(t), occurredAt: t.occurredAt, key: '', merchant: '', category: '', big: isBigPurchase(spend(t), median90, t.isBig) })),
      startOfWibWeek(now),
      dataStartsAt,
    );

    const dailyAmounts: number[] = [];
    for (const r of dailyRows) dailyAmounts[r.dayOfWeek] = Number(r.amount);
    const learned = s.autoWeights ? learnedWeights(baseline.avgByDow, baseline.weeksObserved) : null;
    const weights = learned ?? normalizeWeights(dailyAmounts);

    // Batas periode. Pemasukan pasti utama dengan jadwal yang sama → gaji lebih awal membuka periode baru (cycleBounds).
    const schedule = periodSchedule(s.period, s.periodDay);
    const pasti = streams.filter(isPastiStream);
    const anchor = pasti.find((p) => {
      if (p.id !== s.anchorStreamId) return false;
      const a = streamSchedule(p);
      return a.cadence === schedule.cadence && (a.cadence === 'WEEKLY' ? a.payDayOfWeek === schedule.payDayOfWeek : a.payDayOfMonth === schedule.payDayOfMonth);
    });
    const recentByStream = new Map(
      await Promise.all(
        pasti.map(async (p) => [
          p.id,
          await this.prisma.income.findMany({
            where: { userId, streamId: p.id, status: IncomeStatus.CONFIRMED, receivedAt: { lte: now } },
            orderBy: { receivedAt: 'desc' },
            take: 6,
            select: { amount: true, receivedAt: true },
          }),
        ] as const),
      ),
    );
    const { start, end } = cycleBounds(anchor ? streamSchedule(anchor) : schedule, now, anchor ? recentByStream.get(anchor.id)?.[0]?.receivedAt : null);
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);

    const inPeriod = await this.prisma.income.findMany({
      where: { userId, status: IncomeStatus.CONFIRMED, receivedAt: { gte: start, lte: now } },
      select: { amount: true, streamId: true },
    });
    const pastiIds = new Set(pasti.map((p) => p.id));
    const pastiRows = pasti.map((p) => {
      const rows = inPeriod.filter((i) => i.streamId === p.id);
      const usual = usualAmount((recentByStream.get(p.id) ?? []).map((r) => Number(r.amount)), declaredAmount(p));
      const dates = paydayDates(streamSchedule(p), start, end);
      const received = rows.reduce((t, r) => t + Number(r.amount), 0);
      const part = pastiPart({ usual: usual.amount, paydays: dates.length, received, receivedCount: rows.length });
      const due = dates[rows.length];
      return {
        id: p.id, name: p.name, usual: usual.amount, learned: usual.learned, paydays: dates.length,
        received: Math.round(received), receivedCount: rows.length, expected: Math.round(part.expected),
        // Payday terjadwal yang sudah lewat tapi belum ada pemasukan tercatat → "belum masuk". Payday sebelum user mulai
        // memakai Trackster tidak dihitung telat: uangnya kemungkinan sudah diterima sebelum daftar.
        lateSince: due && due.getTime() < todayStart.getTime() && due.getTime() >= startOfWibDay(dataStartsAt).getTime() ? wibDateKey(due) : null,
      };
    });
    const tambahan = inPeriod.filter((i) => i.streamId == null || !pastiIds.has(i.streamId)).reduce((t, i) => t + Number(i.amount), 0);

    const activeFrom = startOfWibDay(dataStartsAt);
    const firstPeriod = activeFrom.getTime() > start.getTime();
    const effectiveStart = firstPeriod ? activeFrom : start;
    const usualSpend = baseline.usualWeekly != null ? round500((baseline.usualWeekly / 7) * totalDays) : null;
    const dailySum = dailyAmounts.reduce((t, a) => t + (a ?? 0), 0);
    const target = s.targetAmount ?? usualSpend ?? round500((dailySum / 7) * totalDays);

    // Sisa periode lalu (satu tingkat): pemasukan nyata − disisihkan, atau target, dikurangi belanjanya.
    let carry = 0;
    if (s.rolloverEnabled && !firstPeriod) {
      const [prev] = previousPeriods(schedule, start, 1);
      if (prev.start.getTime() >= activeFrom.getTime()) {
        const prevIncome = (await this.prisma.income.aggregate({
          _sum: { amount: true },
          where: { userId, status: IncomeStatus.CONFIRMED, receivedAt: { gte: prev.start, lt: prev.end } },
        }))._sum.amount;
        const prevBudget = s.basis === BudgetBasis.INCOME ? Number(prevIncome ?? 0) * (1 - s.reservePct / 100) : target;
        carry = Math.max(0, Math.round(prevBudget - spentIn(prev.start, prev.end)));
      }
    }

    const input: PeriodAllowanceInput = {
      now, start, end, basis: s.basis,
      pastiReceived: pastiRows.reduce((t, p) => t + p.received, 0),
      pastiExpected: pastiRows.reduce((t, p) => t + p.expected, 0),
      tambahan, target, reservePct: s.reservePct, carry,
      // Langganan yang sudah lewat jatuh tempo sudah terbayar → masuk belanja; hanya hitung yang akan datang.
      commitments: commitmentsBetween(subs, wibDateKey(todayStart), wibDateKey(end)),
      spentBeforeToday: spentIn(effectiveStart, todayStart),
      weights, activeFrom,
    };
    const result = computePeriodAllowance(input);
    const balance = balances.reduce((t, b) => t + Number(b.balance), 0);
    const burn = spentIn(addWibDays(todayStart, -7), todayStart) / 7;

    return {
      median90,
      cycle: {
        mode: 'PERIOD' as const,
        basis: s.basis,
        period: s.period,
        periodDay: s.periodDay,
        start: wibDateKey(start),
        end: wibDateKey(end),
        daysTotal: totalDays,
        ...result,
        tambahan: Math.round(tambahan),
        reservePct: s.reservePct,
        target: s.basis === BudgetBasis.TARGET ? Math.round(target) : null,
        targetIsUsual: s.basis === BudgetBasis.TARGET && s.targetAmount == null && usualSpend != null,
        carry,
        commitments: Math.round(input.commitments),
        firstPeriod,
        pasti: pastiRows,
        pastiPending: pastiRows.filter((p) => p.lateSince).map((p) => ({ name: p.name, dueDate: p.lateSince! })),
        usualSpend,
        weeksObserved: baseline.weeksObserved,
        style: activeStyle(s.basis, s.reservePct, target, usualSpend),
        styles: stylePreviews(input, usualSpend),
        weights,
        weightsLearned: !!learned,
        balance: Math.round(balance),
        runwayDays: burn > 0 ? Math.max(0, Math.floor(balance / burn)) : null,
        rolloverEnabled: s.rolloverEnabled,
        autoWeights: s.autoWeights,
        anchorStreamId: s.anchorStreamId,
        needsReview: s.needsReview,
      },
    };
  }

  async getTodaySummary(userId: number) {
    const now = new Date();
    const settings = await this.getSettings(userId);
    const { cycle, median90 } = await this.computePeriod(userId, now, settings);
    const budget = cycle.allowance;
    const { start: startOfDay, end: endOfDay } = wibRange('day', now);

    const [transactions, incomes] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: startOfDay, lt: endOfDay } },
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.income.findMany({
        where: { userId, receivedAt: { gte: startOfDay, lt: endOfDay } },
        orderBy: { receivedAt: 'desc' },
      }),
    ]);

    const totalSpent = transactions.reduce((sum, t) => sum + spend(t), 0);
    const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const transactionsWithDisplay = await this.merchantAliasService.attachDisplayNames(userId, transactions);

    // Pembelian besar sudah mengurangi sisa periode, jadi tidak ikut alert "over budget hari ini".
    // Ambang = analytics.getPeriodStats (median 90 hari s.d. akhir hari ini) supaya "besar" di budget = "besar" di Analisis.
    const bigThreshold = bigPurchaseThreshold(median90);
    const bigSpent = transactions.filter((t) => isBigPurchase(spend(t), median90, t.isBig)).reduce((s, t) => s + spend(t), 0);
    // Jatah dinamis → simpan per hari supaya kepatuhan budget di analytics bisa dihitung belakangan.
    const date = new Date(`${wibDateKey(now)}T00:00:00Z`);
    await this.prisma.dailyAllowance.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, amount: budget },
      update: { amount: budget },
    });
    const budgetSpent = totalSpent - bigSpent;

    return {
      date: wibDateKey(now),
      mode: settings.basis,
      budget,
      baseBudget: budget,
      rollover: 0,
      totalSpent,
      bigSpent,
      bigThreshold,
      remaining: budget - budgetSpent,
      isOverBudget: budgetSpent > budget,
      cycle,
      totalIncome,
      netAmount: totalIncome - totalSpent,
      isNetPositive: totalIncome - totalSpent >= 0,
      transactions: transactionsWithDisplay,
      incomes,
    };
  }

  /** Runway forecast: estimasi kondisi keuangan akhir bulan berdasarkan burn rate 7 hari terakhir.
   *  Tidak butuh LLM — murni kalkulasi deterministik. */
  async getRunwayForecast(userId: number) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Burn rate: rata-rata pengeluaran per hari dalam 7 hari terakhir
    const spentAgg = await this.prisma.transaction.aggregate({
      _sum: { amount: true, reimbursedAmount: true },
      where: { userId, occurredAt: { gte: sevenDaysAgo, lte: now } },
    });
    const totalSpent7d = sumSpend(spentAgg._sum);
    const burnRatePerDay = totalSpent7d / 7;

    // Sisa hari di bulan ini (kalender WIB)
    const { start: monthStart, end: monthEnd } = wibRange('month', now);
    const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86_400_000);
    const dayOfMonth = Math.round((wibRange('day', now).start.getTime() - monthStart.getTime()) / 86_400_000) + 1;
    const remainingDays = daysInMonth - dayOfMonth;

    // Saldo BCA + Jago saat ini
    const balances = await this.prisma.bankBalance.findMany({ where: { userId } });
    const currentBalance = balances.reduce((sum, b) => sum + Number(b.balance), 0);

    const projectedEndOfMonthBalance = currentBalance - burnRatePerDay * remainingDays;
    const isProjectedShortfall = projectedEndOfMonthBalance < 0;

    return {
      burnRatePerDay: Math.round(burnRatePerDay),
      currentBalance: Math.round(currentBalance),
      remainingDays,
      projectedEndOfMonthBalance: Math.round(projectedEndOfMonthBalance),
      isProjectedShortfall,
    };
  }
}
