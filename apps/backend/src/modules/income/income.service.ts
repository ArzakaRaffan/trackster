import { Injectable } from '@nestjs/common';
import { IncomeOrigin, IncomeStatus, ParseStatus, Source } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { BalanceService, shouldAdjustBalance } from '../balance/balance.service';
import { IncomeForecastService } from '../income-forecast/income-forecast.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { ResolveIncomeDto } from './dto/resolve-income.dto';
import { addWibDays, startOfWibDay, startOfWibWeek } from '../../common/wib';
import { isOwnerName } from '../gmail/parsers/own-accounts';

export interface ParsedIncome {
  amount: number;
  description: string; // nama pengirim mentah dari email
  source: Source;
  occurredAt: Date;
  emailId: string;
}

/** ±3 jam — jendela korelasi FLIPTECH: BCA→Flip (SoF) lalu Flip→Jago sendiri biasanya beda
 * beberapa menit, bukan jam, tapi kasih jarak buat proses/antrian bank. */
const FLIPTECH_CORRELATION_WINDOW_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class IncomeService {
  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
    private incomeForecastService: IncomeForecastService,
  ) {}

  async findAll(params: { startDate?: string; endDate?: string; status?: IncomeStatus }) {
    const { startDate, endDate, status } = params;
    const where: any = {};
    if (startDate || endDate) {
      where.receivedAt = {};
      if (startDate) where.receivedAt.gte = startOfWibDay(startDate);
      if (endDate) where.receivedAt.lt = addWibDays(startOfWibDay(endDate), 1);
    }
    if (status) where.status = status;
    return this.prisma.income.findMany({ where, orderBy: { receivedAt: 'desc' }, include: { stream: true } });
  }

  async create(dto: CreateIncomeDto) {
    return this.prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          amount: dto.amount,
          description: dto.description,
          source: dto.source,
          receivedAt: new Date(dto.receivedAt),
        },
      });
      await this.balanceService.adjustBalance(tx, income.source, Number(income.amount));
      return income;
    });
  }

  /** Reverse efek balance dari data lama dulu, baru apply data baru — lebih simpel & aman
   * daripada ngitung selisih per-field, dan tetap benar walau amount dan source dua-duanya berubah. */
  async update(id: number, dto: UpdateIncomeDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.income.findUniqueOrThrow({ where: { id } });
      await this.balanceService.adjustBalance(tx, existing.source, -Number(existing.amount));

      const updated = await tx.income.update({
        where: { id },
        data: {
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.source !== undefined && { source: dto.source }),
          ...(dto.receivedAt !== undefined && { receivedAt: new Date(dto.receivedAt) }),
        },
      });
      await this.balanceService.adjustBalance(tx, updated.source, Number(updated.amount));
      return updated;
    });
  }

  /** Auto-capture dari email (E02-S1) — dedup via externalId (emailId Gmail), lalu klasifikasi
   * CONFIRMED/INTERNAL/PENDING. Saldo JAGO **selalu** gerak (uang beneran masuk), terlepas dari
   * status — klasifikasi cuma soal "ini pemasukan siapa/apa", bukan soal saldo. */
  async createFromParsed(parsed: ParsedIncome) {
    const existing = await this.prisma.income.findUnique({ where: { externalId: parsed.emailId } });
    if (existing) return null;

    const { status, streamId } = await this.classify(parsed);
    const periodStart = streamId ? startOfWibWeek(parsed.occurredAt) : undefined;

    return this.prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          amount: parsed.amount,
          description: parsed.description,
          source: parsed.source,
          receivedAt: parsed.occurredAt,
          status,
          origin: IncomeOrigin.EMAIL,
          externalId: parsed.emailId,
          ...(streamId ? { streamId, periodStart } : {}),
        },
      });

      const lastAdjustmentAt = await this.balanceService.getLastManualAdjustmentAt(tx, income.source);
      if (shouldAdjustBalance(income.receivedAt, lastAdjustmentAt)) {
        await this.balanceService.adjustBalance(tx, income.source, Number(income.amount));
      }

      return income;
    });
  }

  /** Pengirim = owner sendiri → INTERNAL. Cocok `matchKeywords` stream aktif → CONFIRMED. Pengirim
   * FLIPTECH (Flip) yang berkorelasi dengan EmailParseLog EXCLUDED nominal sama ±3 jam (top-up via
   * Flip ke rekening sendiri) → INTERNAL. Selain itu (termasuk FLIPTECH tanpa korelasi — bisa orang
   * lain kirim via Flip) → PENDING, muncul di "Perlu dicek". */
  private async classify(parsed: ParsedIncome): Promise<{ status: IncomeStatus; streamId: number | null }> {
    const sender = parsed.description.toUpperCase();

    if (isOwnerName(sender)) {
      return { status: IncomeStatus.INTERNAL, streamId: null };
    }

    const streams = await this.prisma.incomeStream.findMany({ where: { isActive: true } });
    const matched = streams.find((s) => s.matchKeywords.some((kw) => sender.includes(kw.toUpperCase())));
    if (matched) {
      return { status: IncomeStatus.CONFIRMED, streamId: matched.id };
    }

    if (sender.includes('FLIPTECH')) {
      const correlated = await this.prisma.emailParseLog.findFirst({
        where: {
          status: ParseStatus.EXCLUDED,
          amount: parsed.amount,
          receivedAt: {
            gte: new Date(parsed.occurredAt.getTime() - FLIPTECH_CORRELATION_WINDOW_MS),
            lte: new Date(parsed.occurredAt.getTime() + FLIPTECH_CORRELATION_WINDOW_MS),
          },
        },
      });
      if (correlated) return { status: IncomeStatus.INTERNAL, streamId: null };
    }

    return { status: IncomeStatus.PENDING, streamId: null };
  }

  /** User menyelesaikan income PENDING dari halaman "Perlu dicek": pilih stream (→ CONFIRMED) atau
   * tandai bukan pemasukan/internal (→ INTERNAL). Saldo tidak disentuh lagi — sudah bergerak saat dibuat. */
  async resolve(id: number, dto: ResolveIncomeDto) {
    const income = await this.prisma.income.findUniqueOrThrow({ where: { id } });

    if (dto.notIncome) {
      return this.prisma.income.update({ where: { id: income.id }, data: { status: IncomeStatus.INTERNAL } });
    }

    if (dto.streamId) {
      return this.prisma.income.update({
        where: { id: income.id },
        data: { status: IncomeStatus.CONFIRMED, streamId: dto.streamId, periodStart: startOfWibWeek(income.receivedAt) },
      });
    }

    return income;
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.income.delete({ where: { id } });
      await this.balanceService.adjustBalance(tx, deleted.source, -Number(deleted.amount));
      return deleted;
    });
  }

  /** Smoothed daily allowance: total forecast ekspektasi (E03-S2) untuk `windowDays` ke depan / windowDays,
   *  dikali faktor tabungan. Diganti dari rata-rata historis mentah ke forecast per stream — forward-looking,
   *  jadi tidak rusak kalau user berhenti mencatat manual.
   *  Faktor 0.7 = asumsi 30% income disisihkan untuk tabungan/darurat — bisa di-tuning. */
  async getSmoothedDailyAllowance(windowDays = 30) {
    const weeks = Math.max(1, Math.ceil(windowDays / 7));
    const horizon = await this.incomeForecastService.getHorizon(weeks);
    const totalIncome = horizon.reduce((sum, w) => sum + w.totals.expected, 0);
    const averageDailyIncome = totalIncome / (weeks * 7);

    // 0.7 = faktor tabungan. Asumsi: 30% income disisihkan untuk tabungan/darurat.
    // Angka ini keputusan produk sederhana — dokumentasikan di sini biar tidak jadi magic number.
    const SAVINGS_FACTOR = 0.7;
    const suggestedDailyAllowance = averageDailyIncome * SAVINGS_FACTOR;

    return {
      windowDays,
      totalIncome: Math.round(totalIncome),
      averageDailyIncome: Math.round(averageDailyIncome),
      suggestedDailyAllowance: Math.round(suggestedDailyAllowance),
      savingsFactor: SAVINGS_FACTOR,
    };
  }

  /** Rekomendasi alokasi mingguan: forecast ekspektasi minggu ini (E03-S2) dikurangi target budget
   *  mingguan (jumlah 7 DailyBudget) = leftover, lalu leftover dibagi tabung/invest/jajan-bebas.
   *  Diganti dari rata-rata historis mentah ke forecast per stream — forecast selalu punya angka
   *  (fallback ke typicalUnits/amount stream kalau belum ada histori check-in), jadi `isFallback`
   *  sekarang berarti "belum ada stream aktif sama sekali" (forecast expected = 0), bukan lagi
   *  "belum ada income tercatat X hari terakhir". Rasio 50/30/20 keputusan produk sederhana (sama
   *  semangatnya dengan SAVINGS_FACTOR di atas) — tuning kalau prioritas finansial berubah. */
  async getAllocationRecommendation() {
    const [week, budgets] = await Promise.all([this.incomeForecastService.getWeekForecast(), this.prisma.dailyBudget.findMany()]);

    const weeklyIncome = week.totals.expected;
    const weeklyBudgetTarget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const leftover = Math.max(0, weeklyIncome - weeklyBudgetTarget);

    const SAVE_RATIO = 0.5;
    const INVEST_RATIO = 0.3;
    const SPEND_RATIO = 0.2;

    return {
      windowDays: 7,
      isFallback: weeklyIncome === 0,
      weeklyIncome: Math.round(weeklyIncome),
      weeklyBudgetTarget: Math.round(weeklyBudgetTarget),
      leftover: Math.round(leftover),
      allocation: {
        save: Math.round(leftover * SAVE_RATIO),
        invest: Math.round(leftover * INVEST_RATIO),
        spend: Math.round(leftover * SPEND_RATIO),
      },
      ratios: { save: SAVE_RATIO, invest: INVEST_RATIO, spend: SPEND_RATIO },
    };
  }
}
