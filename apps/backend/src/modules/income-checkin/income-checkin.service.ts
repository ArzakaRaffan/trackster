import { BadRequestException, Injectable } from '@nestjs/common';
import { IncomeKind, IncomeStream } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { BalanceService, shouldAdjustBalance } from '../balance/balance.service';
import { IncomeForecastService, isScheduledInWeek } from '../income-forecast/income-forecast.service';
import { addWibDays, startOfWibWeek, wibDateKey, wibRange } from '../../common/wib';
import { CheckinEntryDto, SubmitCheckinDto } from './dto/submit-checkin.dto';

export interface CheckinAmountInput {
  units?: number;
  extraUnits?: number;
  amount?: number;
}

export interface CheckinStreamConfig {
  kind: IncomeKind;
  amount: number | null;
  sessionRate: number | null;
  sessionExtra: number | null;
  deductionPerUnit: number | null;
}

export interface CheckinAmountResult {
  amount: number;
  units: number | null;
  extraUnits: number | null;
}

const round = (n: number) => Math.round(n);

/** Hitung nominal & units yang disimpan buat satu entry check-in — pure function, lihat
 * income-checkin.check.ts. Sama semangatnya dengan calcStreamForecast: dites tanpa DB. */
export function calcCheckinAmount(stream: CheckinStreamConfig, entry: CheckinAmountInput): CheckinAmountResult {
  switch (stream.kind) {
    case 'FIXED':
      return { amount: round(stream.amount ?? 0), units: null, extraUnits: null };
    case 'SESSION': {
      const units = entry.units ?? 0;
      // Sesi offline tidak mungkin lebih banyak dari total sesi.
      const extraUnits = Math.min(entry.extraUnits ?? 0, units);
      const amount = units * (stream.sessionRate ?? 0) + extraUnits * (stream.sessionExtra ?? 0);
      return { amount: round(amount), units, extraUnits };
    }
    case 'DEDUCTION': {
      const absentDays = entry.units ?? 0;
      const amount = Math.max(0, (stream.amount ?? 0) - absentDays * (stream.deductionPerUnit ?? 0));
      return { amount: round(amount), units: absentDays, extraUnits: null };
    }
    case 'VARIABLE':
    case 'IRREGULAR':
    default:
      return { amount: round(entry.amount ?? 0), units: null, extraUnits: null };
  }
}

export interface CheckinStreamDraft {
  id: number;
  name: string;
  kind: IncomeKind;
  source: IncomeStream['source'];
  sessionRate: number | null;
  sessionExtra: number | null;
  maxUnits: number | null;
  deductionPerUnit: number | null;
  amount: number | null;
  typicalUnits: number | null;
  /** Jadwal minggu ini (WEEKLY selalu true; MONTHLY cuma di minggu payday; IRREGULAR selalu false
   * tapi tetap boleh diisi opsional — lihat komentar di getDraft). */
  scheduled: boolean;
  /** Sudah ada Income tercatat untuk stream+minggu ini (dari checkin sebelumnya, manual, atau auto-capture). */
  alreadyFilled: boolean;
  recordedAmount: number;
  expected: number;
  max: number;
}

export interface CheckinDraft {
  weekStart: string;
  weekEndLabel: string;
  streams: CheckinStreamDraft[];
  totalExpected: number;
  totalRecorded: number;
}

@Injectable()
export class IncomeCheckinService {
  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
    private incomeForecastService: IncomeForecastService,
  ) {}

  private normalizeWeek(weekParam?: string): Date {
    const anchor = weekParam ? new Date(`${weekParam}T00:00:00+07:00`) : new Date();
    if (isNaN(anchor.getTime())) throw new BadRequestException('Tanggal minggu tidak valid');
    return startOfWibWeek(anchor);
  }

  async getDraft(weekParam?: string): Promise<CheckinDraft> {
    const weekStart = this.normalizeWeek(weekParam);
    const { end: weekEnd } = wibRange('week', weekStart);
    const weekStartKey = wibDateKey(weekStart);

    const [streams, forecast, existing] = await Promise.all([
      this.prisma.incomeStream.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
      this.incomeForecastService.getWeekForecast(weekStartKey),
      this.prisma.income.findMany({ where: { periodStart: weekStart }, select: { streamId: true, amount: true } }),
    ]);

    const filledStreamIds = new Set(existing.map((e) => e.streamId).filter((id): id is number => id != null));
    const forecastById = new Map(forecast.streams.map((s) => [s.id, s]));

    const drafts: CheckinStreamDraft[] = streams.map((s) => {
      const scheduled = s.kind === 'IRREGULAR' ? true : isScheduledInWeek(s, weekStart, weekEnd);
      const f = forecastById.get(s.id);
      const recorded = existing.filter((e) => e.streamId === s.id).reduce((sum, e) => sum + Number(e.amount), 0);
      return {
        id: s.id,
        name: s.name,
        kind: s.kind,
        source: s.source,
        sessionRate: s.sessionRate != null ? Number(s.sessionRate) : null,
        sessionExtra: s.sessionExtra != null ? Number(s.sessionExtra) : null,
        maxUnits: s.maxUnits,
        deductionPerUnit: s.deductionPerUnit != null ? Number(s.deductionPerUnit) : null,
        amount: s.amount != null ? Number(s.amount) : null,
        typicalUnits: s.typicalUnits != null ? Number(s.typicalUnits) : null,
        scheduled,
        alreadyFilled: filledStreamIds.has(s.id),
        recordedAmount: recorded,
        expected: f?.expected ?? 0,
        max: f?.max ?? 0,
      };
    });

    return {
      weekStart: weekStartKey,
      weekEndLabel: wibDateKey(addWibDays(weekEnd, -1)),
      streams: drafts,
      totalExpected: drafts.reduce((sum, s) => sum + (s.scheduled ? s.expected : 0), 0),
      totalRecorded: drafts.reduce((sum, s) => sum + s.recordedAmount, 0),
    };
  }

  /** Streams yang WAJIB diisi buat dianggap "minggu ini sudah checkin" — WEEKLY selalu, MONTHLY
   * cuma di minggu payday-nya. IRREGULAR sengaja tidak masuk (opsional, "tak terduga"). */
  async isWeekFilled(weekParam?: string): Promise<boolean> {
    const draft = await this.getDraft(weekParam);
    return draft.streams.filter((s) => s.kind !== 'IRREGULAR' && s.scheduled).every((s) => s.alreadyFilled);
  }

  async submit(dto: SubmitCheckinDto) {
    const weekStart = startOfWibWeek(new Date(`${dto.week}T00:00:00+07:00`));
    const receivedAt = addWibDays(weekStart, 6); // Minggu (akhir minggu) — kapan pemasukan itu biasanya "cair"

    return this.submitEntries(weekStart, receivedAt, dto.entries);
  }

  /** Dipakai juga oleh handler callback_query Telegram (jawaban cepat FIXED/DEDUCTION). */
  async submitEntries(weekStart: Date, receivedAt: Date, entries: CheckinEntryDto[]) {
    const streamIds = entries.map((e) => e.streamId);
    const streams = await this.prisma.incomeStream.findMany({ where: { id: { in: streamIds } } });
    const streamById = new Map(streams.map((s) => [s.id, s]));

    const created: { streamId: number; amount: number }[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const stream = streamById.get(entry.streamId);
        if (!stream) continue;

        // Jangan dobel — kalau sudah ada Income buat stream+minggu ini (dari checkin lain, manual,
        // atau auto-capture), skip diam-diam (idempotent kalau tombol Telegram ke-tap dua kali).
        const dup = await tx.income.findFirst({ where: { streamId: stream.id, periodStart: weekStart } });
        if (dup) continue;

        const { amount, units, extraUnits } = calcCheckinAmount(
          {
            kind: stream.kind,
            amount: stream.amount != null ? Number(stream.amount) : null,
            sessionRate: stream.sessionRate != null ? Number(stream.sessionRate) : null,
            sessionExtra: stream.sessionExtra != null ? Number(stream.sessionExtra) : null,
            deductionPerUnit: stream.deductionPerUnit != null ? Number(stream.deductionPerUnit) : null,
          },
          entry,
        );

        const income = await tx.income.create({
          data: {
            amount,
            description: `${stream.name} — check-in mingguan`,
            source: stream.source,
            receivedAt,
            streamId: stream.id,
            periodStart: weekStart,
            units: units != null ? units : undefined,
            extraUnits: extraUnits != null ? extraUnits : undefined,
            origin: 'CHECKIN',
          },
        });

        if (amount > 0) {
          const lastAdjustmentAt = await this.balanceService.getLastManualAdjustmentAt(tx, income.source);
          if (shouldAdjustBalance(receivedAt, lastAdjustmentAt)) {
            await this.balanceService.adjustBalance(tx, income.source, amount);
          }
        }

        created.push({ streamId: stream.id, amount });
      }
    });

    return created;
  }
}
