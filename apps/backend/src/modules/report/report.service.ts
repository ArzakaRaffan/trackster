import { Injectable, Logger } from '@nestjs/common';
import { ReportPeriod } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AnalyticsService, PeriodStats } from '../analytics/analytics.service';
import { AiService } from '../ai/ai.service';
import { startOfWibDay, wibRange } from '../../common/wib';

const NARRATIVE_PROMPT = `Kamu adalah Trackster AI — financial buddy personal Arzaka.
Tugas: Tulis ringkasan laporan periode (minggu atau bulan) keuangan Arzaka dalam Bahasa Indonesia santai, 3-5 kalimat.
Pakai HANYA angka dari data JSON yang diberikan (jangan mengarang angka). Sebut:
1. Satu hal yang bagus di periode ini
2. Satu hal yang perlu diperbaiki
3. Satu saran konkret buat periode berikutnya
Tidak perlu salam pembuka/penutup formal.`;

export interface ReportResult {
  period: 'week' | 'month';
  start: string;
  end: string;
  closed: boolean;
  stats: PeriodStats;
  narrative: string | null;
  generatedAt: string | null;
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private prisma: PrismaService,
    private analyticsService: AnalyticsService,
    private aiService: AiService,
  ) {}

  /** `period`: 'week'|'month', `anchorDate` jatuh di dalam periode yang diminta.
   * Periode yang sudah tutup (end <= sekarang) dibaca/dibuat dari snapshot `PeriodReport`
   * (konsisten walau data berubah kemudian); periode berjalan selalu live dari PeriodStats. */
  async getReport(period: 'week' | 'month', anchorDate: Date): Promise<ReportResult> {
    const { start, end } = wibRange(period, anchorDate);
    const dbPeriod = period === 'week' ? ReportPeriod.WEEK : ReportPeriod.MONTH;

    if (end.getTime() <= Date.now()) {
      const saved = await this.getOrGenerate(dbPeriod, start, end);
      return {
        period,
        start: start.toISOString(),
        end: end.toISOString(),
        closed: true,
        stats: saved.stats as unknown as PeriodStats,
        narrative: saved.narrative,
        generatedAt: saved.generatedAt.toISOString(),
      };
    }

    const stats = await this.analyticsService.getPeriodStats(start, end);
    return { period, start: start.toISOString(), end: end.toISOString(), closed: false, stats, narrative: null, generatedAt: null };
  }

  private async getOrGenerate(period: ReportPeriod, start: Date, end: Date) {
    const existing = await this.prisma.periodReport.findUnique({
      where: { period_periodStart: { period, periodStart: start } },
    });
    if (existing) return existing;
    return this.closePeriod(period, start, end);
  }

  /** Hitung PeriodStats + narasi AI, simpan snapshot. Dipanggil cron tutup periode ATAU
   * lazy on-demand kalau ada yang buka laporan lama yang belum pernah di-tutup (backfill implisit). */
  async closePeriod(period: ReportPeriod, start: Date, end: Date) {
    const stats = await this.analyticsService.getPeriodStats(start, end);

    let narrative: string | null = null;
    try {
      const res = await this.aiService.chat({
        system: NARRATIVE_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(stats) }],
        maxTokens: 400,
      });
      narrative = res?.content?.trim() || null;
    } catch (err: any) {
      this.logger.error(`closePeriod narrative gagal (${period} ${start.toISOString()}): ${err?.message}`);
    }

    return this.prisma.periodReport.upsert({
      where: { period_periodStart: { period, periodStart: start } },
      update: { stats: stats as any, narrative },
      create: { period, periodStart: start, stats: stats as any, narrative },
    });
  }

  /** anchor = hari apapun di minggu/bulan LALU (relatif ke `now`), dipakai cron tutup periode. */
  lastClosedWeekAnchor(now: Date): Date {
    return startOfWibDay(new Date(now.getTime() - 86_400_000));
  }

  lastClosedMonthAnchor(now: Date): Date {
    return startOfWibDay(new Date(wibRange('month', now).start.getTime() - 86_400_000));
  }
}
