import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';

// AiChatService di-inject lazy lewat forwardRef nanti di Phase 1.
// Untuk Phase 0, controller ini sudah berdiri dan siap menerima webhook —
// handleMessage akan di-wire setelah AiChatService ada.

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private telegramService: TelegramService,
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

    // 2. Pastikan ada text message
    const message = body?.message;
    if (!message?.text) {
      // Bukan text message (sticker, foto, dll) — no-op
      return { ok: true };
    }

    // 3. Validasi chat ID — cegah orang lain ngobrol ke bot dan baca data finansial
    const incomingChatId = message.chat?.id?.toString();
    const config = await this.telegramService.getConfigRaw();

    if (!config || incomingChatId !== config.chatId) {
      this.logger.warn(
        Webhook dari chat ID tidak dikenal:  — diabaikan.,
      );
      // Return 200 tanpa info apapun — jangan beri clue ke caller
      return { ok: true };
    }

    // 4. Log untuk verifikasi Phase 0 (Phase 1 akan replace ini dengan AiChatService.handleMessage)
    this.logger.log(Pesan masuk dari Telegram (chatId ): );

    return { ok: true };
  }
}
