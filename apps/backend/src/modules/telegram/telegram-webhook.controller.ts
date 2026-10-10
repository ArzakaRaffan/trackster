import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { TelegramService, escHtml } from './telegram.service';
import { aiQuotaOk } from '../../common/guards/ai-rate-limit.guard';
import { AiChatService } from '../ai/ai-chat.service';
import { IncomeCheckinReminderService } from '../income-checkin/income-checkin-reminder.service';
import { AiBudgetReminderService } from '../ai/ai-budget-reminder.service';

const digest = (s: string) => createHash('sha256').update(s).digest();
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b)); // panjang sama -> tak bocor lewat waktu

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private telegramService: TelegramService,
    private aiChatService: AiChatService,
    private incomeCheckinReminderService: IncomeCheckinReminderService,
    private aiBudgetReminderService: AiBudgetReminderService,
  ) {}

  /** Public endpoint — TANPA JWT guard.
   *  Validasi: secret di path + chat.id harus cocok config DB. */
  @Post('webhook/:secret')
  @HttpCode(200)
  async handleWebhook(
    @Param('secret') secret: string,
    @Body() body: any,
  ) {
    // 1. Validasi secret
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expectedSecret || !safeEqual(secret, expectedSecret)) {
      this.logger.warn('Webhook secret tidak valid, akses ditolak.');
      throw new ForbiddenException('Invalid secret');
    }

    // 2. Callback query (tombol inline keyboard check-in pemasukan E03-S3) — jalur terpisah dari text message
    const callbackQuery = body?.callback_query;
    if (callbackQuery) {
      const incomingChatId = callbackQuery.message?.chat?.id?.toString();
      const config = incomingChatId ? await this.telegramService.getConfigByChatId(incomingChatId) : null;
      if (!config || !config.userId) {
        this.logger.warn(`Callback query dari chat ID tidak dikenal: ${incomingChatId} — diabaikan.`);
        return { ok: true };
      }
      // userId ditentukan SERVER dari chatId yang terdaftar — tidak pernah dari isi pesan.
      const userId = config.userId;
      try {
        if (typeof callbackQuery.data === 'string' && callbackQuery.data.startsWith('ba:')) {
          await this.aiBudgetReminderService.handleCallback(userId, callbackQuery);
        } else {
          await this.incomeCheckinReminderService.handleCallback(userId, callbackQuery);
        }
      } catch (err: any) {
        this.logger.error(`Error handle callback_query check-in: ${err?.message}`);
      }
      return { ok: true };
    }

    // 3. Pastikan ada text message
    const message = body?.message;
    if (!message?.text) {
      // Bukan text message (sticker, foto, dll) — no-op
      return { ok: true };
    }

    // 4. Validasi chat ID — cegah orang lain ngobrol ke bot dan baca data finansial
    const incomingChatId = message.chat?.id?.toString();

    // Tautan bot bersama: `/start <kode>` dari chat yang belum dikenal (kode dibuat user di Settings).
    const start = /^\/start\s+(\S+)/.exec(message.text);
    if (start && incomingChatId) {
      const linked = await this.telegramService.linkChatByCode(incomingChatId, start[1]);
      await this.telegramService.sendToChat(
        incomingChatId,
        linked ? '✅ Telegram terhubung ke Trackster. Notifikasi & chat AI aktif di sini.' : 'Kode tidak valid atau sudah kedaluwarsa. Buat kode baru di Trackster → Settings.',
      );
      return { ok: true };
    }

    const config = incomingChatId ? await this.telegramService.getConfigByChatId(incomingChatId) : null;

    if (!config || !config.userId) {
      this.logger.warn(
        `Webhook dari chat ID tidak dikenal: ${incomingChatId} — diabaikan.`,
      );
      // Return 200 tanpa info — jangan beri clue ke caller
      return { ok: true };
    }

    // 4. Dispatch ke AI chat dan kirim balasan ke Telegram
    const text: string = message.text;
    this.logger.log(`Pesan masuk dari Telegram (chatId ${incomingChatId}): ${text.slice(0, 100)}`);

    // Proses async — langsung return 200 ke Telegram, jawaban dikirim terpisah
    // (Telegram timeout 5 detik kalau webhook tidak segera respond)
    const userId = config.userId;
    if (!aiQuotaOk(`${userId}|telegram-chat`)) {
      await this.telegramService.sendMessage(userId, 'Batas chat AI tercapai. Coba lagi nanti ya.');
      return { ok: true };
    }
    setImmediate(async () => {
      try {
        const reply = await this.aiChatService.handleMessage(userId, text, { channel: 'telegram' });
        await this.telegramService.sendMessage(userId, escHtml(reply));
      } catch (err: any) {
        this.logger.error(`Error handle telegram message: ${err?.message}`);
        await this.telegramService.sendMessage(userId, 'Maaf, ada gangguan teknis. Coba lagi ya!');
      }
    });

    return { ok: true };
  }
}
