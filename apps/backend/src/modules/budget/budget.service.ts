import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BudgetMode, IncomeCadence, IncomeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { UpdateBudgetSettingsDto } from './dto/update-budget-settings.dto';
import { computeBalanceAllowance, computeCycleAllowance, cycleBounds, normalizeWeights } from './budget-cycle';
import { calcStreamForecast } from '../income-forecast/income-forecast.service';
import { bigPurchaseThreshold, isBigPurchase, median } from '../analytics/period-stats.util';
import { forEachActiveUser } from '../../common/per-user';
import { MerchantAliasService } from '../merchant-alias/merchant-alias.service';
import { addWibDays, startOfWibDay, startOfWibWeek, wibDateKey, wibDayOfWeek, wibRange } from '../../common/wib';
import { calcRollover } from './budget-rollover';
import { spend, sumSpend } from '../../common/spend';

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);

  constructor(
    private prisma: PrismaService,
    private merchantAliasService: MerchantAliasService,
  ) {}

  async getAll(userId: number) {
    return this.prisma.dailyBudget.findMany({ where: { userId }, orderBy: { dayOfWeek: 'asc' } });
  }

  async updateAll(userId: number, dto: UpdateBudgetDto) {
    const results: Awaited<ReturnType<typeof this.prisma.dailyBudget.create>>[] = [];
    for (const item of dto.budgets) {
      // findFirst + updateMany/create (bukan upsert by `dayOfWeek`): unik masih global sampai C1 -> (userId, dayOfWeek).
      const row = await this.prisma.dailyBudget.findFirst({ where: { userId, dayOfWeek: item.dayOfWeek }, select: { id: true } });
      if (row) {
        await this.prisma.dailyBudget.updateMany({ where: { id: row.id, userId }, data: { amount: item.amount } });
        results.push(await this.prisma.dailyBudget.findFirstOrThrow({ where: { id: row.id, userId } }));
      } else {
        results.push(await this.prisma.dailyBudget.create({ data: { userId, dayOfWeek: item.dayOfWeek, amount: item.amount } }));
      }
    }
    return results;
  }

  /** Ambil budget untuk hari tertentu (0=Minggu...6=Sabtu) */
  async getBudgetForDay(userId: number, dayOfWeek: number): Promise<number> {
    const row = await this.prisma.dailyBudget.findFirst({ where: { userId, dayOfWeek } });
    return row ? Number(row.amount) : 0;
  }

  async getRolloverEnabled(userId: number): Promise<boolean> {
    const row = await this.prisma.budgetSetting.findFirst({ where: { userId } });
    return row?.rolloverEnabled ?? false;
  }

  async setRolloverEnabled(userId: number, enabled: boolean) {
    // Satu baris per user (bukan lagi singleton id=1); unik `userId` dipasang di C1.
    const existing = await this.prisma.budgetSetting.findFirst({ where: { userId }, select: { id: true } });
    if (existing) {
      await this.prisma.budgetSetting.updateMany({ where: { id: existing.id, userId }, data: { rolloverEnabled: enabled } });
    } else {
      await this.prisma.budgetSetting.create({ data: { userId, rolloverEnabled: enabled } });
    }
    return { rolloverEnabled: enabled };
  }

  /** Sisa budget Senin..kemarin (minggu berjalan) yang belum terpakai — 0 di hari Senin. */
  private async computeRollover(userId: number, now: Date): Promise<number> {
    const weekStart = startOfWibWeek(now);
    const todayStart = startOfWibDay(now);
    if (weekStart.getTime() === todayStart.getTime()) return 0;

    const [rows, txs] = await Promise.all([
      this.prisma.dailyBudget.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: weekStart, lt: todayStart } },
        select: { amount: true, reimbursedAmount: true, occurredAt: true },
      }),
    ]);
    const budgetByDow = new Map(rows.map((r) => [r.dayOfWeek, Number(r.amount)]));
    const spentByDay = new Map<string, number>();
    for (const t of txs) {
      const key = wibDateKey(t.occurredAt);
      spentByDay.set(key, (spentByDay.get(key) ?? 0) + spend(t));
    }

    const days: { budget: number; spent: number }[] = [];
    for (let d = weekStart; d < todayStart; d = addWibDays(d, 1)) {
      days.push({ budget: budgetByDow.get(wibDayOfWeek(d)) ?? 0, spent: spentByDay.get(wibDateKey(d)) ?? 0 });
    }
    return calcRollover(days);
  }

  async getSettings(userId: number) {
    const s = await this.prisma.budgetSetting.findFirst({ where: { userId } });
    return {
      rolloverEnabled: s?.rolloverEnabled ?? false,
      mode: s?.mode ?? BudgetMode.FIXED,
      anchorStreamId: s?.anchorStreamId ?? null,
      reservePct: s?.reservePct ?? 10,
      horizonDays: s?.horizonDays ?? 30,
    };
  }

  async updateSettings(userId: number, dto: UpdateBudgetSettingsDto) {
    const current = await this.getSettings(userId);
    const next = { ...current, ...dto };
    if (next.anchorStreamId != null) {
      const stream = await this.prisma.incomeStream.findFirst({ where: { id: next.anchorStreamId, userId, isActive: true } });
      if (!stream || stream.cadence === IncomeCadence.NONE) {
        throw new BadRequestException('anchorStreamId harus income rutin (mingguan/bulanan) yang aktif');
      }
    }
    if (next.mode === BudgetMode.CYCLE && next.anchorStreamId == null) {
      throw new BadRequestException('Mode siklus butuh income utama (anchorStreamId)');
    }
    const data = { mode: next.mode, anchorStreamId: next.anchorStreamId, reservePct: next.reservePct, horizonDays: next.horizonDays };
    const existing = await this.prisma.budgetSetting.findFirst({ where: { userId }, select: { id: true } });
    if (existing) await this.prisma.budgetSetting.updateMany({ where: { id: existing.id, userId }, data });
    else await this.prisma.budgetSetting.create({ data: { userId, ...data } });
    return this.getSettings(userId);
  }

  /** Jatah dinamis hari ini untuk mode CYCLE/BALANCE (docs/siklus-gajian.md). Anchor hilang/nonaktif → BALANCE. */
  private async computeDynamic(userId: number, now: Date, setting: Awaited<ReturnType<BudgetService['getSettings']>>) {
    const todayStart = startOfWibDay(now);
    const rows = await this.prisma.dailyBudget.findMany({ where: { userId } });
    const amounts: number[] = [];
    for (const r of rows) amounts[r.dayOfWeek] = Number(r.amount);
    const weights = normalizeWeights(amounts);
    // `nextDueDate` itu @db.Date: Prisma memotong parameter ke tanggal UTC, jadi batas 00:00 WIB (= 17:00 UTC kemarin)
    // harus dikirim sebagai tanggal kalender WIB-nya, kalau tidak langganan di hari terakhir rentang ikut terbuang.
    const asDate = (x: Date) => new Date(`${wibDateKey(x)}T00:00:00Z`);
    const dueBetween = async (from: Date, to: Date) => {
      const subs = await this.prisma.subscription.findMany({
        where: { userId, isActive: true, nextDueDate: { gte: asDate(from), lt: asDate(to) } },
        select: { amount: true },
      });
      return subs.reduce((s, x) => s + Number(x.amount), 0);
    };
    const spentBetween = async (from: Date, to: Date) =>
      sumSpend((await this.prisma.transaction.aggregate({
        _sum: { amount: true, reimbursedAmount: true },
        where: { userId, occurredAt: { gte: from, lt: to } },
      }))._sum);

    const stream = setting.mode === BudgetMode.CYCLE && setting.anchorStreamId != null
      ? await this.prisma.incomeStream.findFirst({ where: { id: setting.anchorStreamId, userId, isActive: true } })
      : null;

    const cadence = stream?.cadence;
    if (stream && (cadence === IncomeCadence.WEEKLY || cadence === IncomeCadence.MONTHLY)) {
      const anchor = { cadence, payDayOfWeek: stream.payDayOfWeek, payDayOfMonth: stream.payDayOfMonth };
      const anchorIncomes = await this.prisma.income.findMany({
        where: { userId, streamId: stream.id, status: IncomeStatus.CONFIRMED, receivedAt: { lte: now } },
        orderBy: { receivedAt: 'desc' },
        take: 3,
        select: { amount: true, receivedAt: true },
      });
      const { start, end } = cycleBounds(anchor, now, anchorIncomes[0]?.receivedAt);
      const incomeBetween = (from: Date, to: Date) => this.prisma.income.findMany({
        where: { userId, status: IncomeStatus.CONFIRMED, receivedAt: { gte: from, lte: to } },
        select: { amount: true, streamId: true },
      });
      const sumAmount = (rows: { amount: unknown }[]) => rows.reduce((s, i) => s + Number(i.amount), 0);
      const inCycle = await incomeBetween(start, now);
      // Baris anchor bernominal 0 (check-in "tidak dapat") = MISSED → anchorReceived 0, bukan fallback ke expected.
      const anchorRows = inCycle.filter((i) => i.streamId === stream.id);
      const anchorSum = sumAmount(anchorRows);

      // Rollover: sisa siklus sebelumnya (pemasukan nyata − cadangan − belanja), satu tingkat saja.
      // Siklus pertama (akun dibuat setelah siklus mulai): sebagian uang siklus ini mungkin sudah terpakai sebelum memakai
      // Trackster. Saldo pernah dikoreksi manual → saldo = sisa uang ('BALANCE'); belum → tetap perkiraan gaji ('ESTIMATE').
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
      const isFirst = !!user && user.createdAt.getTime() > start.getTime();
      const balanceKnown = isFirst && !!(await this.prisma.balanceAdjustment.findFirst({ where: { userId }, select: { id: true } }));
      const firstCycle = !isFirst ? null : balanceKnown ? ('BALANCE' as const) : ('ESTIMATE' as const);

      let carry = 0;
      if (setting.rolloverEnabled && !isFirst) {
        const prevEnd = new Date(start.getTime() - 1);
        const prev = cycleBounds(anchor, prevEnd, anchorIncomes.find((i) => i.receivedAt < start)?.receivedAt);
        const prevIncome = sumAmount(await incomeBetween(prev.start, prevEnd));
        carry = Math.max(0, Math.round(prevIncome * (1 - setting.reservePct / 100) - (await spentBetween(prev.start, start))));
      }
      // ponytail: expected = rata-rata 3 pembayaran anchor terakhir; belum ada histori → konfigurasi stream.
      const anchorExpected = anchorIncomes.length
        ? anchorIncomes.reduce((s, i) => s + Number(i.amount), 0) / anchorIncomes.length
        : calcStreamForecast(
            {
              kind: stream.kind, cadence: stream.cadence,
              amount: stream.amount && Number(stream.amount), sessionRate: stream.sessionRate && Number(stream.sessionRate),
              sessionExtra: stream.sessionExtra && Number(stream.sessionExtra), maxUnits: stream.maxUnits,
              deductionPerUnit: stream.deductionPerUnit && Number(stream.deductionPerUnit), typicalUnits: stream.typicalUnits && Number(stream.typicalUnits),
            },
            { historicalAmounts: [], historicalAbsences: [], isScheduledThisWeek: true },
          ).expected;
      // Komitmen yang sudah lewat jatuh tempo sudah terbayar → masuk `spentBeforeToday`, jadi hanya hitung yang akan datang.
      const commitments = await dueBetween(todayStart, end);
      const balanceStart = balanceKnown
        ? (await this.prisma.bankBalance.findMany({ where: { userId }, select: { balance: true } })).reduce((s, b) => s + Number(b.balance), 0)
          + (await spentBetween(todayStart, addWibDays(todayStart, 1))) // belanja hari ini dikembalikan → jatah beku per hari
        : 0;
      const result = balanceKnown
        ? computeCycleAllowance({
            now, cycleStart: start, cycleEnd: end, weights, commitments,
            anchorExpected: 0, anchorReceived: balanceStart, otherIncome: 0, carry: 0, reservePct: 0, spentBeforeToday: 0,
          })
        : computeCycleAllowance({
        now, cycleStart: start, cycleEnd: end, weights,
        anchorExpected,
        anchorReceived: anchorRows.length ? anchorSum : null,
        otherIncome: sumAmount(inCycle.filter((i) => i.streamId !== stream.id)),
        carry,
        commitments,
        reservePct: setting.reservePct,
        spentBeforeToday: await spentBetween(start, todayStart),
      });
      return {
        mode: BudgetMode.CYCLE, cycleStart: wibDateKey(start), cycleEnd: wibDateKey(end), runwayDays: null, carry, firstCycle,
        // Siklus sudah jalan tapi gaji belum tercatat → UI tampilkan "gaji belum masuk" (jatah masih pakai perkiraan).
        // Siklus pertama: gajinya masuk sebelum daftar, jadi tidak dianggap tertunda.
        anchorPending: !anchorRows.length && todayStart.getTime() > start.getTime() && !isFirst,
        ...result,
      };
    }

    const balances = await this.prisma.bankBalance.findMany({ where: { userId }, select: { balance: true } });
    const horizonEnd = addWibDays(todayStart, setting.horizonDays);
    const result = computeBalanceAllowance({
      now, weights,
      balance: balances.reduce((s, b) => s + Number(b.balance), 0),
      spentToday: await spentBetween(todayStart, addWibDays(todayStart, 1)),
      commitments: await dueBetween(todayStart, horizonEnd),
      horizonDays: setting.horizonDays,
      burnRatePerDay: (await spentBetween(addWibDays(todayStart, -7), todayStart)) / 7,
    });
    return { mode: BudgetMode.BALANCE, cycleStart: null, cycleEnd: null, carry: 0, firstCycle: null, anchorPending: false, ...result };
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
    await forEachActiveUser(this.prisma, this.logger, 'daily-allowance-snapshot', async (userId) => {
      if ((await this.getSettings(userId)).mode !== BudgetMode.FIXED) await this.getTodaySummary(userId);
    });
  }

  async getTodaySummary(userId: number) {
    const now = new Date();
    const dayOfWeek = wibDayOfWeek(now);
    const setting = await this.getSettings(userId);
    const dynamic = setting.mode === BudgetMode.FIXED ? null : await this.computeDynamic(userId, now, setting);
    // `budget` = budget efektif hari ini (termasuk sisa kemarin kalau rollover aktif), supaya semua
    // pemakai summary (alert over-budget, progress bar, snapshot AI) otomatis konsisten.
    const baseBudget = dynamic ? dynamic.allowance : await this.getBudgetForDay(userId, dayOfWeek);
    const rollover = !dynamic && setting.rolloverEnabled ? await this.computeRollover(userId, now) : 0;
    const budget = baseBudget + rollover;

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

    // Mode dinamis: pembelian besar sudah mengurangi sisa siklus, jadi tidak ikut alert "over budget hari ini".
    let bigSpent = 0;
    let bigThreshold: number | null = null;
    if (dynamic) {
      // Jendela median = analytics.getPeriodStats (90 hari s.d. akhir hari ini) supaya "besar" di budget = "besar" di Analisis.
      const window90d = await this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: addWibDays(endOfDay, -90), lt: endOfDay } },
        select: { amount: true, reimbursedAmount: true },
      });
      const median90d = median(window90d.map(spend));
      bigThreshold = bigPurchaseThreshold(median90d);
      bigSpent = transactions.filter((t) => isBigPurchase(spend(t), median90d, t.isBig)).reduce((s, t) => s + spend(t), 0);
      // Jatahnya dinamis → simpan per hari supaya kepatuhan budget di analytics bisa dihitung belakangan.
      const date = new Date(`${wibDateKey(now)}T00:00:00Z`);
      await this.prisma.dailyAllowance.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date, amount: budget },
        update: { amount: budget },
      });
    }
    const budgetSpent = totalSpent - bigSpent;

    return {
      date: wibDateKey(now),
      mode: setting.mode,
      budget,
      baseBudget,
      rollover,
      totalSpent,
      bigSpent,
      bigThreshold,
      remaining: budget - budgetSpent,
      isOverBudget: budgetSpent > budget,
      cycle: dynamic,
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
