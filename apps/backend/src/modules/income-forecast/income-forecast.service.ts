import { Injectable } from '@nestjs/common';
import { IncomeCadence, IncomeKind } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { addWibDays, startOfWibMonth, startOfWibWeek, wibDateKey, wibParts, wibRange } from '../../common/wib';

export type StreamForecastStatus = 'RECEIVED' | 'PARTIAL' | 'PENDING' | 'MISSED';

export interface StreamForecast {
  id: number;
  name: string;
  kind: IncomeKind;
  conservative: number;
  expected: number;
  max: number;
  received: number;
  status: StreamForecastStatus;
}

export interface WeekForecastTotals {
  conservative: number;
  expected: number;
  max: number;
  received: number;
}

export interface WeekForecast {
  weekStart: string; // 'YYYY-MM-DD' WIB
  streams: StreamForecast[];
  totals: WeekForecastTotals;
  upsideMonthly: number;
}

/** Kolom yang dipakai `calcStreamForecast` — subset field `IncomeStream`, bukan model Prisma penuh,
 * biar gampang dites dengan fixture tanpa DB (lihat income-forecast.check.ts). */
export interface StreamForecastConfig {
  kind: IncomeKind;
  cadence: IncomeCadence;
  amount: number | null;
  sessionRate: number | null;
  sessionExtra: number | null;
  maxUnits: number | null;
  deductionPerUnit: number | null;
  typicalUnits: number | null;
}

export interface StreamForecastCalcInput {
  /** Nominal aktual per periode (8 minggu terakhir untuk SESSION, 3 bulan terakhir untuk VARIABLE),
   * terurut bebas — cuma dipakai min/rata-rata/maks. */
  historicalAmounts: number[];
  /** Hari absen aktual per minggu, 8 minggu terakhir (DEDUCTION saja). */
  historicalAbsences: number[];
  /** false untuk stream MONTHLY di minggu yang tidak memuat `payDayOfMonth` — forecast-nya 0
   * di minggu itu (bukan berarti gagal, cuma belum jadwalnya). */
  isScheduledThisWeek: boolean;
}

export interface StreamForecastAmounts {
  conservative: number;
  expected: number;
  max: number;
}

const round = (n: number) => Math.round(n);
const average = (arr: number[]) => arr.reduce((sum, n) => sum + n, 0) / arr.length;

/** Forecast per stream, deterministik — lihat tabel formula di docs/revamp/epics/E03-income-model.md.
 * Pure function: tidak menyentuh DB/waktu-sekarang, jadi bisa dites langsung dengan fixture. */
export function calcStreamForecast(stream: StreamForecastConfig, input: StreamForecastCalcInput): StreamForecastAmounts {
  if (!input.isScheduledThisWeek) {
    return { conservative: 0, expected: 0, max: 0 };
  }

  switch (stream.kind) {
    case 'FIXED': {
      const amount = stream.amount ?? 0;
      return { conservative: amount, expected: amount, max: amount };
    }
    case 'SESSION': {
      const rate = stream.sessionRate ?? 0;
      const extra = stream.sessionExtra ?? 0;
      const maxUnits = stream.maxUnits ?? 0;
      const max = maxUnits * (rate + extra);
      const hist = input.historicalAmounts;
      const expected = hist.length >= 3 ? average(hist) : (stream.typicalUnits ?? 0) * (rate + extra);
      const conservative = hist.length >= 1 ? Math.min(...hist) : max * 0.5;
      return { conservative: round(conservative), expected: round(expected), max: round(max) };
    }
    case 'DEDUCTION': {
      const amount = stream.amount ?? 0;
      const perUnit = stream.deductionPerUnit ?? 0;
      // typicalUnits di sini = tebakan hari absen biasa sebelum ada histori (0 = default "biasanya masuk terus").
      const fallbackAbsence = stream.typicalUnits ?? 0;
      const absences = input.historicalAbsences;
      const avgAbsence = absences.length > 0 ? average(absences) : fallbackAbsence;
      const maxAbsence = absences.length > 0 ? Math.max(...absences) : fallbackAbsence;
      return {
        max: round(amount),
        expected: round(Math.max(0, amount - avgAbsence * perUnit)),
        conservative: round(Math.max(0, amount - maxAbsence * perUnit)),
      };
    }
    case 'VARIABLE': {
      const amount = stream.amount ?? 0;
      const hist = input.historicalAmounts;
      if (hist.length === 0) return { conservative: amount, expected: amount, max: amount };
      return { conservative: round(Math.min(...hist)), expected: round(average(hist)), max: round(Math.max(...hist)) };
    }
    case 'IRREGULAR':
    default:
      return { conservative: 0, expected: 0, max: 0 };
  }
}

/** Status satu stream di satu minggu. `expected === 0` berarti stream itu memang tidak dijadwalkan
 * minggu ini (mis. VARIABLE bulanan di luar payDayOfMonth) — jangan dicap MISSED. */
export function deriveStreamStatus(received: number, expected: number, weekEnded: boolean): StreamForecastStatus {
  if (received > 0) return received >= expected ? 'RECEIVED' : 'PARTIAL';
  if (expected === 0) return 'PENDING';
  return weekEnded ? 'MISSED' : 'PENDING';
}

/** Apakah minggu [weekStart, weekEnd) itu jadwal terima buat stream ini. WEEKLY = tiap minggu;
 * MONTHLY = cuma minggu yang memuat `payDayOfMonth`; NONE (IRREGULAR) = tidak pernah dijadwalkan. */
export function isScheduledInWeek(
  stream: { cadence: IncomeCadence; payDayOfMonth: number | null },
  weekStart: Date,
  weekEnd: Date,
): boolean {
  if (stream.cadence === 'WEEKLY') return true;
  if (stream.cadence === 'NONE') return false;
  // MONTHLY: cek apakah tanggal payDayOfMonth (di bulan weekStart ATAU weekEnd, buat minggu yang
  // melintasi pergantian bulan) jatuh di rentang minggu ini.
  if (stream.payDayOfMonth == null) return false;
  // Minggu bisa melintasi pergantian bulan, jadi cek payday di bulan weekStart maupun weekEnd-1.
  const candidateMonths = [wibParts(weekStart), wibParts(addWibDays(weekEnd, -1))];
  for (const { year, month } of candidateMonths) {
    const monthStart = startOfWibMonth(year, month);
    const nextMonthStart = month === 12 ? startOfWibMonth(year + 1, 1) : startOfWibMonth(year, month + 1);
    const daysInMonth = Math.round((nextMonthStart.getTime() - monthStart.getTime()) / 86_400_000);
    const day = Math.min(stream.payDayOfMonth, daysInMonth);
    const payDate = addWibDays(monthStart, day - 1);
    if (payDate.getTime() >= weekStart.getTime() && payDate.getTime() < weekEnd.getTime()) return true;
  }
  return false;
}

@Injectable()
export class IncomeForecastService {
  constructor(private prisma: PrismaService) {}

  async getWeekForecast(dateStr?: string): Promise<WeekForecast> {
    const anchor = dateStr ? new Date(`${dateStr}T00:00:00+07:00`) : new Date();
    return this.computeWeek(anchor);
  }

  async getHorizon(weeks: number): Promise<WeekForecast[]> {
    const startWeek = startOfWibWeek(new Date());
    const results: WeekForecast[] = [];
    for (let i = 0; i < weeks; i++) {
      results.push(await this.computeWeek(addWibDays(startWeek, i * 7)));
    }
    return results;
  }

  private async computeWeek(anchor: Date): Promise<WeekForecast> {
    const { start: weekStart, end: weekEnd } = wibRange('week', anchor);
    const { year, month } = wibParts(weekStart);
    const monthStart = startOfWibMonth(year, month);
    const now = new Date();
    const weekEnded = now.getTime() >= weekEnd.getTime();

    const streams = await this.prisma.incomeStream.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });

    const results: StreamForecast[] = [];
    for (const stream of streams) {
      const scheduled = isScheduledInWeek(stream, weekStart, weekEnd);
      const [historicalAmounts, historicalAbsences] = await Promise.all([
        this.needsAmountHistory(stream.kind) ? this.fetchHistoricalAmounts(stream, weekStart, monthStart) : [],
        stream.kind === 'DEDUCTION' ? this.fetchHistoricalAbsences(stream.id, weekStart) : [],
      ]);
      const amounts = calcStreamForecast(
        {
          kind: stream.kind,
          cadence: stream.cadence,
          amount: stream.amount != null ? Number(stream.amount) : null,
          sessionRate: stream.sessionRate != null ? Number(stream.sessionRate) : null,
          sessionExtra: stream.sessionExtra != null ? Number(stream.sessionExtra) : null,
          maxUnits: stream.maxUnits,
          deductionPerUnit: stream.deductionPerUnit != null ? Number(stream.deductionPerUnit) : null,
          typicalUnits: stream.typicalUnits != null ? Number(stream.typicalUnits) : null,
        },
        { historicalAmounts, historicalAbsences, isScheduledThisWeek: scheduled },
      );
      const received = await this.fetchReceived(stream, weekStart, weekEnd, monthStart);
      const status = deriveStreamStatus(received, amounts.expected, weekEnded);
      results.push({ id: stream.id, name: stream.name, kind: stream.kind, ...amounts, received: round(received), status });
    }

    const totals = results.reduce<WeekForecastTotals>(
      (acc, s) => ({
        conservative: acc.conservative + s.conservative,
        expected: acc.expected + s.expected,
        max: acc.max + s.max,
        received: acc.received + s.received,
      }),
      { conservative: 0, expected: 0, max: 0, received: 0 },
    );

    const upsideMonthly = await this.getUpsideMonthly();

    return { weekStart: wibDateKey(weekStart), streams: results, totals, upsideMonthly };
  }

  private needsAmountHistory(kind: IncomeKind): boolean {
    return kind === 'SESSION' || kind === 'VARIABLE';
  }

  /** SESSION: 8 minggu terakhir (sebelum minggu yang sedang di-forecast). VARIABLE: 3 bulan terakhir
   * (sebelum bulan yang sedang di-forecast) — granularitas beda karena cadence-nya beda. */
  private async fetchHistoricalAmounts(
    stream: { id: number; kind: IncomeKind; cadence: IncomeCadence },
    weekStart: Date,
    monthStart: Date,
  ): Promise<number[]> {
    const before = stream.cadence === 'MONTHLY' ? monthStart : weekStart;
    const take = stream.cadence === 'MONTHLY' ? 3 : 8;
    const rows = await this.prisma.income.findMany({
      where: { streamId: stream.id, status: 'CONFIRMED', periodStart: { not: null, lt: before } },
      orderBy: { periodStart: 'desc' },
      take,
      select: { amount: true },
    });
    return rows.map((r) => Number(r.amount));
  }

  private async fetchHistoricalAbsences(streamId: number, weekStart: Date): Promise<number[]> {
    const rows = await this.prisma.income.findMany({
      where: { streamId, status: 'CONFIRMED', periodStart: { not: null, lt: weekStart }, units: { not: null } },
      orderBy: { periodStart: 'desc' },
      take: 8,
      select: { units: true },
    });
    return rows.map((r) => Number(r.units));
  }

  /** Entry lama yang belum di-link ke stream (streamId null, dari sebelum E03) ikut dihitung kalau
   * `receivedAt`-nya jatuh di minggu ini — biar forecast tidak buta terhadap data historis yang belum
   * di-backfill (lihat catatan "Link income lama ke stream" di E03-S1, ditunda ke UI edit income). */
  private async fetchReceived(
    stream: { id: number; cadence: IncomeCadence },
    weekStart: Date,
    weekEnd: Date,
    monthStart: Date,
  ): Promise<number> {
    const periodMatch = stream.cadence === 'MONTHLY' ? { periodStart: monthStart } : { periodStart: { gte: weekStart, lt: weekEnd } };
    const agg = await this.prisma.income.aggregate({
      _sum: { amount: true },
      where: {
        streamId: stream.id,
        status: 'CONFIRMED',
        OR: [periodMatch, { periodStart: null, receivedAt: { gte: weekStart, lt: weekEnd } }],
      },
    });
    return Number(agg._sum.amount ?? 0);
  }

  /** Rata-rata pemasukan IRREGULAR (mis. project) 3 bulan terakhir — ditampilkan terpisah sebagai
   * "upside", tidak masuk total forecast utama (tidak bisa diandalkan buat perencanaan). */
  private async getUpsideMonthly(): Promise<number> {
    const since = addWibDays(startOfWibWeek(new Date()), -90);
    const agg = await this.prisma.income.aggregate({
      _sum: { amount: true },
      where: { status: 'CONFIRMED', receivedAt: { gte: since }, stream: { kind: 'IRREGULAR' } },
    });
    return round(Number(agg._sum.amount ?? 0) / 3);
  }
}
