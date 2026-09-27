import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  Logger,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { AiChatService } from '../ai/ai-chat.service';
import { IncomeCheckinCronService } from '../income-checkin/income-checkin-cron.service';

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private telegramService: TelegramService,
    private aiChatService: AiChatService,
    @Inject(forwardRef(() => IncomeCheckinCronService))
    private incomeCheckinCronService: IncomeCheckinCronService,
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
    if (!expectedSecret || secret !== expectedSecret) {
      this.logger.warn('Webhook secret tidak valid, akses ditolak.');
      throw new ForbiddenException('Invalid secret');
    }

    // 2. Callback query (tombol inline keyboard) — check-in pemasukan E03-S3
    const callbackQuery = body?.callback_query;
    if (callbackQuery) {
      return this.handleCallbackQuery(callbackQuery);
    }

    // 3. Pastikan ada text message
    const message = body?.message;
    if (!message?.text) {
      // Bukan text message (sticker, foto, dll) — no-op
      return { ok: true };
    }

    // 4. Validasi chat ID — cegah orang lain ngobrol ke bot dan baca data finansial
    const incomingChatId = message.chat?.id?.toString();
    const config = await this.telegramService.getConfigRaw();

    if (!config || incomingChatId !== config.chatId) {
      this.logger.warn(
        `Webhook dari chat ID tidak dikenal: ${incomingChatId} — diabaikan.`,
      );
      // Return 200 tanpa info — jangan beri clue ke caller
      return { ok: true };
    }

    // 5. Dispatch ke AI chat dan kirim balasan ke Telegram
    const text: string = message.text;
    this.logger.log(`Pesan masuk dari Telegram (chatId ${incomingChatId}): ${text.slice(0, 100)}`);

    // Proses async — langsung return 200 ke Telegram, jawaban dikirim terpisah
    // (Telegram timeout 5 detik kalau webhook tidak segera respond)
    setImmediate(async () => {
      try {
        const reply = await this.aiChatService.handleMessage(text, { channel: 'telegram' });
        await this.telegramService.sendMessage(reply);
      } catch (err: any) {
        this.logger.error(`Error handle telegram message: ${err?.message}`);
        await this.telegramService.sendMessage('Maaf, ada gangguan teknis. Coba lagi ya!');
      }
    });

    return { ok: true };
  }

  /** Validasi chat ID sama seperti text message, lalu dispatch ke `IncomeCheckinCronService`. */
  private async handleCallbackQuery(callbackQuery: any) {
    const incomingChatId = callbackQuery.message?.chat?.id?.toString();
    const config = await this.telegramService.getConfigRaw();
    if (!config || incomingChatId !== config.chatId) {
      this.logger.warn(`Callback query dari chat ID tidak dikenal: ${incomingChatId} — diabaikan.`);
      return { ok: true };
    }

    const data: string | undefined = callbackQuery.data;
    if (!data) return { ok: true };

    try {
      const resultText = await this.incomeCheckinCronService.handleCallback(data);
      await this.telegramService.answerCallbackQuery(callbackQuery.id, resultText);
    } catch (err: any) {
      this.logger.error(`Error handle callback_query: ${err?.message}`);
      await this.telegramService.answerCallbackQuery(callbackQuery.id, 'Gagal menyimpan, coba lagi.');
    }

    return { ok: true };
  }
}
