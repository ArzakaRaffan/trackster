import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IncomeCheckinService } from './income-checkin.service';
import { buildCheckinMessage, parseCheckinCallback } from './income-checkin-message';
import { TelegramService } from '../telegram/telegram.service';
import { addWibDays, startOfWibWeek, wibDateKey } from '../../common/wib';
import { PrismaService } from '../../prisma.service';
import { forEachActiveUser } from '../../common/per-user';

@Injectable()
export class IncomeCheckinReminderService {
  private readonly logger = new Logger(IncomeCheckinReminderService.name);

  constructor(
    private prisma: PrismaService,
    private incomeCheckinService: IncomeCheckinService,
    private telegramService: TelegramService,
  ) {}

  private checkinUrl(weekStart: string): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${frontendUrl}/app/income/checkin?week=${weekStart}`;
  }

  /** Minggu 19:00 WIB — sebelum weekly insight report (20:00, lihat ai-reports.service.ts). Tanya
   * pemasukan minggu ini yang masih berjalan (Senin-Minggu, "sekarang" masih di dalamnya). */
  @Cron('0 19 * * 0', { name: 'income-checkin-prompt', timeZone: 'Asia/Jakarta' })
  async weeklyPromptCron() {
    await forEachActiveUser(this.prisma, this.logger, 'income-checkin-prompt', (userId) => this.sendWeeklyPrompt(userId));
  }

  async sendWeeklyPrompt(userId: number) {
    try {
      const weekStart = wibDateKey(startOfWibWeek(new Date()));
      const draft = await this.incomeCheckinService.getDraft(userId, weekStart);
      const { text, keyboard } = buildCheckinMessage('prompt', draft, this.checkinUrl(weekStart));
      await this.telegramService.sendMessageWithKeyboard(userId, text, keyboard);
      this.logger.log(`Check-in prompt terkirim (user ${userId}, minggu ${weekStart})`);
    } catch (err: any) {
      this.logger.error(`sendWeeklyPrompt error: ${err?.message}`);
    }
  }

  /** Senin 12:00 WIB — reminder soal minggu KEMARIN (yang baru saja berakhir), sekali doang kalau
   * belum lengkap diisi. Cron ini sendiri cuma jalan sekali/minggu jadi tidak perlu log dedup. */
  @Cron('0 12 * * 1', { name: 'income-checkin-reminder', timeZone: 'Asia/Jakarta' })
  async mondayReminderCron() {
    await forEachActiveUser(this.prisma, this.logger, 'income-checkin-reminder', (userId) => this.sendMondayReminder(userId));
  }

  async sendMondayReminder(userId: number) {
    try {
      const previousWeekStart = wibDateKey(addWibDays(startOfWibWeek(new Date()), -7));
      const filled = await this.incomeCheckinService.isWeekFilled(userId, previousWeekStart);
      if (filled) {
        this.logger.log(`Check-in minggu ${previousWeekStart} sudah lengkap, skip reminder.`);
        return;
      }
      const draft = await this.incomeCheckinService.getDraft(userId, previousWeekStart);
      const { text, keyboard } = buildCheckinMessage('reminder', draft, this.checkinUrl(previousWeekStart));
      await this.telegramService.sendMessageWithKeyboard(userId, text, keyboard);
      this.logger.log(`Check-in reminder terkirim (minggu ${previousWeekStart})`);
    } catch (err: any) {
      this.logger.error(`sendMondayReminder error: ${err?.message}`);
    }
  }

  /** Dipanggil dari TelegramWebhookController saat callback_query masuk (tombol inline keyboard
   * check-in di-tap). Submit jawaban, lalu edit pesan supaya status ter-refresh. */
  async handleCallback(userId: number, callbackQuery: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } }) {
    const data = callbackQuery.data;
    if (!data) return;
    const parsed = parseCheckinCallback(data);
    if (!parsed) return;

    const weekStart = startOfWibWeek(new Date(`${parsed.weekStart}T00:00:00+07:00`));
    const receivedAt = addWibDays(weekStart, 6);

    const entry =
      parsed.answer === 'fixed'
        ? { streamId: parsed.streamId }
        : /^d([0-3])$/.test(parsed.answer)
          ? { streamId: parsed.streamId, units: Number(parsed.answer[1]) }
          : null;

    if (!entry) return;

    await this.incomeCheckinService.submitEntries(userId, weekStart, receivedAt, [entry]);
    await this.telegramService.answerCallbackQuery(userId, callbackQuery.id, 'Tercatat ✅');

    if (callbackQuery.message) {
      const refreshedDraft = await this.incomeCheckinService.getDraft(userId, parsed.weekStart);
      const isCurrentWeek = parsed.weekStart === wibDateKey(startOfWibWeek(new Date()));
      const { text, keyboard } = buildCheckinMessage(isCurrentWeek ? 'prompt' : 'reminder', refreshedDraft, this.checkinUrl(parsed.weekStart));
      await this.telegramService.editMessage(userId, String(callbackQuery.message.chat.id), callbackQuery.message.message_id, text, keyboard);
    }
  }
}
