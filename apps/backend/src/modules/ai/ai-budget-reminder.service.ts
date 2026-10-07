import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from '../telegram/telegram.service';
import { BudgetService } from '../budget/budget.service';
import { BudgetAdvisorService } from '../budget/budget-advisor.service';
import { AiBudgetService } from './ai-budget.service';
import { WEEK_ORDER, addWibDays, startOfWibWeek, wibDateKey } from '../../common/wib';
import { PrismaService } from '../../prisma.service';
import { forEachActiveUser } from '../../common/per-user';

const OPTION_LABEL: Record<string, string> = { hemat: 'Hemat', seimbang: 'Seimbang', longgar: 'Longgar' };

function parseApplyCallback(data: string): { weekStart: string; option: string } | null {
  const match = /^ba:(\d{4}-\d{2}-\d{2}):(hemat|seimbang|longgar)$/.exec(data);
  if (!match) return null;
  return { weekStart: match[1], option: match[2] };
}

/** E05-S2: setelah check-in pemasukan mingguan (19:00) & alokasi 50/30/20 otomatis (E03-S4, 21:00),
 * kirim saran budget minggu depan dari 3-opsi advisor (E05-S1) + alasan AI. Sengaja dijadwalkan
 * SETELAH cron alokasi 50/30/20 (yang overwrite DailyBudget otomatis tiap Minggu) supaya kalau
 * Arzaka tap "Terapkan" di sini, pilihannya tidak langsung ketiban tertimpa cron itu. */
@Injectable()
export class AiBudgetReminderService {
  private readonly logger = new Logger(AiBudgetReminderService.name);

  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
    private budgetService: BudgetService,
    private budgetAdvisorService: BudgetAdvisorService,
    private aiBudgetService: AiBudgetService,
  ) {}

  @Cron('10 21 * * 0', { name: 'budget-suggestion-followup', timeZone: 'Asia/Jakarta' })
  async followupCron() {
    await forEachActiveUser(this.prisma, this.logger, 'budget-suggestion-followup', (userId) => this.sendFollowup(userId));
  }

  async sendFollowup(userId: number) {
    try {
      const nextWeekStart = wibDateKey(addWibDays(startOfWibWeek(new Date()), 7));
      const { text, keyboard } = await this.buildMessage(userId, nextWeekStart);
      await this.telegramService.sendMessageWithKeyboard(userId, text, keyboard);
      this.logger.log(`Saran budget (user ${userId}) minggu ${nextWeekStart} terkirim.`);
    } catch (err: any) {
      this.logger.error(`sendFollowup error: ${err?.message}`);
    }
  }

  private async buildMessage(userId: number, weekStart: string): Promise<{ text: string; keyboard: TelegramBot.InlineKeyboardButton[][] }> {
    const suggestion = await this.budgetAdvisorService.getSuggestions(userId, weekStart);
    const advice = await this.aiBudgetService.explain(userId, weekStart);
    const chosen = suggestion.options.find(o => o.option === advice.recommended) ?? suggestion.options[1];

    const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
    const weekdayLo = Math.min(...chosen.dailyAmounts.slice(1, 6));
    const weekdayHi = Math.max(...chosen.dailyAmounts.slice(1, 6));
    const weekendAvg = Math.round((chosen.dailyAmounts[0] + chosen.dailyAmounts[6]) / 2);

    const lines = [
      `📅 <b>Saran budget minggu depan</b>`,
      ``,
      `<b>${OPTION_LABEL[chosen.option]}</b>: ${weekdayLo === weekdayHi ? fmt(weekdayLo) : `${fmt(weekdayLo)}–${fmt(weekdayHi)}`}/hari Sen–Jum, ${fmt(weekendAvg)}/hari Sab–Min`,
    ];
    if (advice.reason) lines.push(``, advice.reason);
    if (advice.tip) lines.push(``, `💡 ${advice.tip}`);
    if (chosen.realismFlag) lines.push(``, `⚠️ ${chosen.realismFlag}`);

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: `✅ Terapkan ${OPTION_LABEL[chosen.option]}`, callback_data: `ba:${weekStart}:${chosen.option}` }],
      [{ text: '📊 Lihat opsi lain', url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/app/budget?week=${weekStart}` }],
    ];

    return { text: lines.join('\n'), keyboard };
  }

  /** Dipanggil dari TelegramWebhookController saat tombol "Terapkan" di-tap. */
  async handleCallback(userId: number, callbackQuery: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } }) {
    const data = callbackQuery.data;
    if (!data) return;
    const parsed = parseApplyCallback(data);
    if (!parsed) return;

    const suggestion = await this.budgetAdvisorService.getSuggestions(userId, parsed.weekStart);
    const chosen = suggestion.options.find(o => o.option === parsed.option);
    if (!chosen) return;

    await this.budgetService.updateAll(userId, {
      budgets: chosen.dailyAmounts.map((amount, dayOfWeek) => ({ dayOfWeek, amount })),
    });
    await this.telegramService.answerCallbackQuery(userId, callbackQuery.id, 'Diterapkan ✅');

    if (callbackQuery.message) {
      const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
      const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const text = [
        `✅ <b>Budget ${OPTION_LABEL[chosen.option]} diterapkan</b> (minggu ${parsed.weekStart})`,
        ``,
        ...WEEK_ORDER.map((i) => `${dayNames[i]}: ${fmt(chosen.dailyAmounts[i])}`),
      ].join('\n');
      await this.telegramService.editMessage(userId, String(callbackQuery.message.chat.id), callbackQuery.message.message_id, text);
    }
  }
}
