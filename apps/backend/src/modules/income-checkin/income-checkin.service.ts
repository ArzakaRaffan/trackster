import { Injectable } from '@nestjs/common';
import { IncomeCadence, IncomeKind } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { BalanceService, shouldAdjustBalance } from '../balance/balance.service';
import { IncomeForecastService } from '../income-forecast/income-forecast.service';
import { addWibDays, startOfWibMonth, startOfWibWeek, wibDateKey, wibDateOnly, wibParts } from '../../common/wib';

export interface CheckinStreamDraft {
  id: number;
  name: string;
  kind: IncomeKind;
  cadence: IncomeCadence;
  amount: number | null;
  sessionRate: number | null;
  sessionExtra: number | null;
  maxUnits: number | null;
  deductionPerUnit: number | null;
  conservative: number;
  expected: number;
  max: number;
  recordedAmount: number;
  recorded: boolean;
}

export interface CheckinDraft {
  weekStart: string;
  weekEnd: string;
  totalExpected: number;
  totalRecorded: number;
  streams: CheckinStreamDraft[];
}

export interface CheckinEntryInput {
  streamId: number;
  units?: number;
  extraUnits?: number;
  amount?: number;
}

/** Kolom `IncomeStream` yang dipakai `computeEntryAmount` — subset, bukan model Prisma penuh. */
interface EntryAmountConfig {
  kind: IncomeKind;
  amount: number | null;
  sessionRate: number | null;
  sessionExtra: number | null;
  deductionPerUnit: number | null;
}

/** Nominal aktual dari input check-in (bukan forecast) — dipakai `submit()`. FIXED = nominal stream apa
 *  adanya; SESSION/DEDUCTION dihitung dari unit yang diisi user; VARIABLE = nominal yang diketik user
 *  (fallback ke `amount` stream kalau tidak diisi, sama seperti forecast). Pure function, dites lewat
 *  `income-checkin.check.ts`. */
export function computeEntryAmount(stream: EntryAmountConfig, entry: CheckinEntryInput): number | null {
  switch (stream.kind) {
    case 'FIXED':
      return stream.amount ?? null;
    case 'SESSION': {
      const units = entry.units ?? 0;
      const extraUnits = entry.extraUnits ?? 0;
      const rate = stream.sessionRate ?? 0;
      const extra = stream.sessionExtra ?? 0;
      return Math.round(units * rate + extraUnits * extra);
    }
    case 'DEDUCTION': {
      const absences = entry.units ?? 0;
      const max = stream.amount ?? 0;
      const perUnit = stream.deductionPerUnit ?? 0;
      return Math.round(Math.max(0, max - absences * perUnit));
    }
    case 'VARIABLE':
      return entry.amount ?? stream.amount ?? null;
    case 'IRREGULAR':
    default:
      return null;
  }
}

@Injectable()
export class IncomeCheckinService {
  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
    private incomeForecastService: IncomeForecastService,
  ) {}

  /** Draft check-in minggu ini: reuse `IncomeForecastService` buat angka forecast + received (satu
   *  sumber kebenaran, bukan hitung ulang), tambah field mentah stream (rate/deduction/dst) yang
   *  dibutuhkan UI stepper & `computeEntryAmount`. IRREGULAR & stream yang tidak dijadwalkan minggu ini
   *  (`max === 0`) tidak perlu check-in — dibuang dari daftar. */
  async getDraft(weekStr?: string): Promise<CheckinDraft> {
    const anchor = weekStr ? new Date(`${weekStr}T00:00:00+07:00`) : new Date();
    const weekStart = startOfWibWeek(anchor);
    const weekEnd = addWibDays(weekStart, 7);

    const week = await this.incomeForecastService.getWeekForecast(wibDateKey(weekStart));
    const relevant = week.streams.filter((s) => s.kind !== 'IRREGULAR' && s.max > 0);

    const streamRows = await this.prisma.incomeStream.findMany({
      where: { id: { in: relevant.map((s) => s.id) } },
    });
    const byId = new Map(streamRows.map((s) => [s.id, s]));

    const streams: CheckinStreamDraft[] = relevant
      .filter((s) => byId.has(s.id))
      .map((s) => {
        const stream = byId.get(s.id)!;
        return {
          id: s.id,
          name: s.name,
          kind: s.kind,
          cadence: stream.cadence,
          amount: stream.amount != null ? Number(stream.amount) : null,
          sessionRate: stream.sessionRate != null ? Number(stream.sessionRate) : null,
          sessionExtra: stream.sessionExtra != null ? Number(stream.sessionExtra) : null,
          maxUnits: stream.maxUnits,
          deductionPerUnit: stream.deductionPerUnit != null ? Number(stream.deductionPerUnit) : null,
          conservative: s.conservative,
          expected: s.expected,
          max: s.max,
          recordedAmount: s.received,
          recorded: s.received > 0,
        };
      });

    const totalExpected = streams.reduce((sum, s) => sum + s.expected, 0);
    const totalRecorded = streams.reduce((sum, s) => sum + s.recordedAmount, 0);

    return { weekStart: wibDateKey(weekStart), weekEnd: wibDateKey(addWibDays(weekEnd, -1)), totalExpected, totalRecorded, streams };
  }

  /** Simpan hasil check-in. Stream yang periodenya (minggu/bulan) sudah punya Income CONFIRMED
   *  (dari email/notifikasi E02, atau check-in sebelumnya) di-skip diam-diam — idempotent, aman
   *  dipanggil ulang (tombol Telegram di-tap dua kali, submit form yang re-render). */
  async submit(weekStr: string, entries: CheckinEntryInput[]) {
    const weekStart = startOfWibWeek(new Date(`${weekStr}T00:00:00+07:00`));
    const { year, month } = wibParts(weekStart);
    const monthStart = startOfWibMonth(year, month);

    const created: { streamId: number; amount: number }[] = [];
    for (const entry of entries) {
      const stream = await this.prisma.incomeStream.findUnique({ where: { id: entry.streamId } });
      if (!stream || !stream.isActive) continue;

      const periodStart = wibDateOnly(stream.cadence === 'MONTHLY' ? monthStart : weekStart);
      const alreadyRecorded = await this.fetchRecorded(stream.id, periodStart);
      if (alreadyRecorded > 0) continue;

      const amount = computeEntryAmount(
        {
          kind: stream.kind,
          amount: stream.amount != null ? Number(stream.amount) : null,
          sessionRate: stream.sessionRate != null ? Number(stream.sessionRate) : null,
          sessionExtra: stream.sessionExtra != null ? Number(stream.sessionExtra) : null,
          deductionPerUnit: stream.deductionPerUnit != null ? Number(stream.deductionPerUnit) : null,
        },
        entry,
      );
      if (amount == null) continue;

      await this.prisma.$transaction(async (tx) => {
        const income = await tx.income.create({
          data: {
            amount,
            description: `${stream.name} — check-in`,
            source: stream.source,
            receivedAt: new Date(),
            streamId: stream.id,
            periodStart,
            units: entry.units ?? null,
            extraUnits: entry.extraUnits ?? null,
            status: 'CONFIRMED',
            origin: 'CHECKIN',
          },
        });
        const lastAdjustmentAt = await this.balanceService.getLastManualAdjustmentAt(tx, income.source);
        if (shouldAdjustBalance(income.receivedAt, lastAdjustmentAt)) {
          await this.balanceService.adjustBalance(tx, income.source, Number(income.amount));
        }
      });
      created.push({ streamId: stream.id, amount });
    }
    return created;
  }

  private async fetchRecorded(streamId: number, periodStart: Date): Promise<number> {
    const agg = await this.prisma.income.aggregate({
      _sum: { amount: true },
      where: { streamId, periodStart, status: 'CONFIRMED' },
    });
    return Number(agg._sum.amount ?? 0);
  }
}
