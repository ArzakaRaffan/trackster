import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { BudgetService } from '../budget/budget.service';
import { TransactionService } from '../transaction/transaction.service';
import { IncomeService } from '../income/income.service';

const MASCOT_SYSTEM_PROMPT = `Kamu adalah maskot kecil imut aplikasi finance tracker Trackster, muncul di pojok layar buat nemenin user.
Tugasmu: kasih SATU kalimat pendek (maks 25 kata), santai dan lucu, dalam Bahasa Indonesia, berisi fun fact
atau observasi tentang kondisi finansial user berdasarkan data JSON yang diberikan.
Boleh bandingkan angka pengeluaran/tabungan user dengan hal receh sehari-hari biar kebayang dan related.
ATURAN: JANGAN mengarang angka yang tidak ada di data. JANGAN pakai emoji lebih dari 1.
Jawab HANYA kalimatnya, tanpa tanda kutip, tanpa embel-embel lain.`;

export interface MascotTip {
  kind: 'reminder' | 'fact';
  message: string;
}

@Injectable()
export class AiMascotService {
  private readonly logger = new Logger(AiMascotService.name);

  constructor(
    private aiService: AiService,
    private budgetService: BudgetService,
    private transactionService: TransactionService,
    private incomeService: IncomeService,
  ) {}

  async getTip(): Promise<MascotTip> {
    // Reminder subscription jatuh tempo dihitung deterministik (bukan lewat AI) supaya
    // tanggal & nominalnya selalu akurat, tidak bisa "dikarang" model — didahulukan dari fun fact.
    const reminder = await this.getUpcomingSubscriptionReminder();
    if (reminder) return { kind: 'reminder', message: reminder };

    return { kind: 'fact', message: await this.generateFunFact() };
  }

  private async getUpcomingSubscriptionReminder(): Promise<string | null> {
    const subscriptions = await this.transactionService.getSubscriptions();
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    for (const sub of subscriptions as Array<{
      displayDescription: string;
      averageAmount: number;
      lastSeenAt: string;
    }>) {
      const nextDue = new Date(sub.lastSeenAt).getTime() + 30 * DAY_MS;
      const daysLeft = Math.ceil((nextDue - now) / DAY_MS);
      if (daysLeft < 0 || daysLeft > 3) continue;

      const amount = `Rp${sub.averageAmount.toLocaleString('id-ID')}`;
      return daysLeft === 0
        ? `Langganan "${sub.displayDescription}" (${amount}) kayaknya jatuh tempo hari ini!`
        : `Heads up, langganan "${sub.displayDescription}" (${amount}) sepertinya jatuh tempo ${daysLeft} hari lagi.`;
    }
    return null;
  }

  private async generateFunFact(): Promise<string> {
    const [today, insights, allocation] = await Promise.all([
      this.budgetService.getTodaySummary(),
      this.transactionService.getInsights('30d'),
      this.incomeService.getAllocationRecommendation(),
    ]);

    try {
      const message = await this.aiService.chat({
        system: MASCOT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify({ today, insights, allocation }) }],
        maxTokens: 150,
      });
      return message?.content?.trim() || this.fallbackFact();
    } catch (err) {
      this.logger.warn(`generateFunFact gagal, pakai fallback: ${(err as Error).message}`);
      return this.fallbackFact();
    }
  }

  private fallbackFact(): string {
    return 'Aku lagi ngitung-ngitung dulu, bentar lagi cerita ya!';
  }
}
