import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AiService } from './ai.service';
import { AiMemoryService } from './ai-memory.service';
import { BudgetAdvisorService } from '../budget/budget-advisor.service';
import { BudgetOption } from '../budget/budget-advisor';
import { startOfWibWeek, wibDateKey, startOfWibDay } from '../../common/wib';
import { forUser, getUserName } from '../../common/persona';

const BUDGET_EXPLAIN_PROMPT = `Kamu adalah Trackster AI. Dari 3 opsi budget mingguan (Hemat/Seimbang/Longgar,
JSON) dan memory tentang Arzaka, pilih SATU opsi paling cocok minggu ini dan jelaskan kenapa singkat.
Pertimbangkan: realismFlag (kalau ada, opsi itu kemungkinan jebol), goal/rencana yang lagi dikejar dari memory,
dan event mendatang (acara, ujian, dll) kalau disebut di memory.
Balas HANYA JSON: {"recommended":"hemat"|"seimbang"|"longgar","reason":"2 kalimat kenapa","tip":"1 tips spesifik"}.
Bahasa Indonesia santai, tanpa markdown/penjelasan lain di luar JSON itu.`;

export interface BudgetAdvice {
  recommended: BudgetOption;
  reason: string | null;
  tip: string | null;
}

function parseAdvice(raw: string): BudgetAdvice | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Record<string, unknown>;
  if (!['hemat', 'seimbang', 'longgar'].includes(p.recommended as string)) return null;
  return {
    recommended: p.recommended as BudgetOption,
    reason: typeof p.reason === 'string' ? p.reason : null,
    tip: typeof p.tip === 'string' ? p.tip : null,
  };
}

@Injectable()
export class AiBudgetService {
  private readonly logger = new Logger(AiBudgetService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private aiMemoryService: AiMemoryService,
    private budgetAdvisorService: BudgetAdvisorService,
  ) {}

  /** Cache per minggu (weekStart) di `BudgetAdvice` — generate ulang cuma sekali per minggu. */
  async explain(userId: number, weekParam?: string): Promise<BudgetAdvice> {
    const weekStart = weekParam ? startOfWibDay(weekParam) : startOfWibWeek(new Date());
    const weekKey = wibDateKey(weekStart);

    const cached = await this.prisma.budgetAdvice.findFirst({ where: { userId, weekStart } });
    if (cached) {
      return { recommended: cached.recommended as BudgetOption, reason: cached.reason, tip: cached.tip };
    }

    const advice = await this.generate(userId, weekKey);

    // findFirst + update/create (bukan upsert): unik masih global (weekStart) sampai C1 -> (userId, weekStart).
    const existing = await this.prisma.budgetAdvice.findFirst({ where: { userId, weekStart }, select: { id: true } });
    if (existing) {
      await this.prisma.budgetAdvice.updateMany({ where: { id: existing.id, userId }, data: advice });
    } else {
      await this.prisma.budgetAdvice.create({ data: { userId, weekStart, ...advice } });
    }

    return advice;
  }

  private async generate(userId: number, weekKey: string): Promise<BudgetAdvice> {
    try {
      const suggestion = await this.budgetAdvisorService.getSuggestions(userId, weekKey);
      const memories = await this.aiMemoryService.listActive(userId, 10);

      const res = await this.aiService.chat({
        system: forUser(BUDGET_EXPLAIN_PROMPT, await getUserName(this.prisma, userId)),
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              options: suggestion.options,
              memory: memories.map(m => m.content),
            }),
          },
        ],
        maxTokens: 300,
        model: 'fast',
      });

      const parsed = parseAdvice(res?.content ?? '');
      if (parsed) return parsed;
    } catch (err: any) {
      this.logger.warn(`generate budget advice gagal, fallback Seimbang: ${err?.message}`);
    }
    return { recommended: 'seimbang', reason: null, tip: null };
  }
}
