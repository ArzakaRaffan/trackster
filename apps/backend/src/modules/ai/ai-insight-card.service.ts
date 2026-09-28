import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AiService } from './ai.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { wibDateKey } from '../../common/wib';

const INSIGHT_CARD_PROMPT = `Kamu adalah Trackster AI. Dari data statistik keuangan periode ini (JSON), tulis PERSIS 3 poin
tajam soal kondisi Arzaka — tiap poin satu kalimat pendek dengan angka nyata dari data, bukan generik/nasihat umum.
Balas HANYA array JSON berisi 3 string, tanpa markdown/penjelasan lain. Bahasa Indonesia santai.
Contoh format: ["Poin 1 dengan angka.", "Poin 2 dengan angka.", "Poin 3 dengan angka."]`;

const VALID_RANGES = ['7d', '30d', '90d', 'all'];

function parsePoints(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).slice(0, 3);
}

@Injectable()
export class AiInsightCardService {
  private readonly logger = new Logger(AiInsightCardService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private analyticsService: AnalyticsService,
  ) {}

  /** Cache per (range, hari WIB) — generate ulang cuma sekali sehari per range. */
  async getInsightCard(range: string): Promise<{ points: string[] }> {
    const rangeKey = VALID_RANGES.includes(range) ? range : '30d';
    const dayKey = wibDateKey(new Date());

    const cached = await this.prisma.aiInsightCard.findUnique({ where: { rangeKey_dayKey: { rangeKey, dayKey } } });
    if (cached) return { points: cached.points as string[] };

    const points = await this.generatePoints(rangeKey);

    await this.prisma.aiInsightCard.upsert({
      where: { rangeKey_dayKey: { rangeKey, dayKey } },
      update: { points },
      create: { rangeKey, dayKey, points },
    });

    return { points };
  }

  private async generatePoints(rangeKey: string): Promise<string[]> {
    try {
      const { start, end } = await this.analyticsService.resolvePeriod(rangeKey);
      const stats = await this.analyticsService.getPeriodStats(start, end);

      const message = await this.aiService.chat({
        system: INSIGHT_CARD_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(stats) }],
        maxTokens: 300,
        model: 'fast',
      });

      const points = parsePoints(message?.content ?? '');
      return points.length > 0 ? points : [];
    } catch (err: any) {
      this.logger.warn(`generatePoints gagal, kartu kosong: ${err?.message}`);
      return [];
    }
  }
}
