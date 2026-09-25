import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { PrismaService } from '../../prisma.service';
import { TelegramConfigDto } from './dto/telegram-config.dto';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private prisma: PrismaService) {}

  async getConfig() {
    const config = await this.prisma.telegramConfig.findFirst();
    if (!config) return { configured: false, notifyEveryTransaction: false };
    return {
      configured: true,
      isActive: config.isActive,
      // jangan expose full token ke frontend, cukup preview
      botTokenPreview: config.botToken.slice(0, 8) + '...',
      chatId: config.chatId,
      notifyEveryTransaction: config.notifyEveryTransaction,
    };
  }

  // Partial update: field yang tidak dikirim (undefined) tidak menimpa nilai lama —
  // ini yang bikin toggle notifyEveryTransaction bisa PUT tanpa perlu botToken/chatId.
  async updateConfig(dto: TelegramConfigDto) {
    const existing = await this.prisma.telegramConfig.findFirst();
    if (existing) {
      return this.prisma.telegramConfig.update({
        where: { id: existing.id },
        data: {
          ...(dto.botToken !== undefined && { botToken: dto.botToken }),
          ...(dto.chatId !== undefined && { chatId: dto.chatId }),
          ...(dto.notifyEveryTransaction !== undefined && { notifyEveryTransaction: dto.notifyEveryTransaction }),
          isActive: true,
        },
      });
    }
    return this.prisma.telegramConfig.create({
      data: {
        botToken: dto.botToken ?? '',
        chatId: dto.chatId ?? '',
        notifyEveryTransaction: dto.notifyEveryTransaction ?? false,
        isActive: true,
      },
    });
  }

  async sendMessage(text: string): Promise<boolean> {
    const config = await this.prisma.telegramConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      this.logger.warn('Telegram belum dikonfigurasi, skip kirim pesan.');
      return false;
    }

    try {
      const bot = new TelegramBot(config.botToken, { polling: false });
      await bot.sendMessage(config.chatId, text, { parse_mode: 'HTML' });
      return true;
    } catch (err) {
      this.logger.error(`Gagal kirim pesan Telegram: ${err.message}`);
      return false;
    }
  }

  /** Kirim pesan dengan inline keyboard (checkin mingguan E03-S3). Return chatId+messageId
   * biar caller bisa edit pesan ini lagi nanti (mis. setelah tombol di-tap). */
  async sendMessageWithKeyboard(
    text: string,
    keyboard: TelegramBot.InlineKeyboardButton[][],
  ): Promise<{ chatId: string; messageId: number } | null> {
    const config = await this.prisma.telegramConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      this.logger.warn('Telegram belum dikonfigurasi, skip kirim pesan.');
      return null;
    }

    try {
      const bot = new TelegramBot(config.botToken, { polling: false });
      const sent = await bot.sendMessage(config.chatId, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
      });
      return { chatId: config.chatId, messageId: sent.message_id };
    } catch (err) {
      this.logger.error(`Gagal kirim pesan Telegram (keyboard): ${err.message}`);
      return null;
    }
  }

  /** Edit pesan yang sudah terkirim — dipakai setelah tombol inline keyboard di-tap, biar status
   * ("sudah masuk") ter-refresh tanpa kirim pesan baru. */
  async editMessage(chatId: string, messageId: number, text: string, keyboard?: TelegramBot.InlineKeyboardButton[][]) {
    const config = await this.prisma.telegramConfig.findFirst({ where: { isActive: true } });
    if (!config) return;

    try {
      const bot = new TelegramBot(config.botToken, { polling: false });
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
      });
    } catch (err) {
      this.logger.error(`Gagal edit pesan Telegram: ${err.message}`);
    }
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    const config = await this.prisma.telegramConfig.findFirst({ where: { isActive: true } });
    if (!config) return;

    try {
      const bot = new TelegramBot(config.botToken, { polling: false });
      await bot.answerCallbackQuery(callbackQueryId, text ? { text } : undefined);
    } catch (err) {
      this.logger.error(`Gagal answerCallbackQuery Telegram: ${err.message}`);
    }
  }

  /** Return config row mentah — hanya untuk keperluan internal (validasi webhook), JANGAN expose ke endpoint publik). */
  async getConfigRaw() {
    return this.prisma.telegramConfig.findFirst({ where: { isActive: true } });
  }

  async sendTest() {
    const success = await this.sendMessage('✅ Test notifikasi dari Trackster berhasil!');
    return { success };
  }

  /** Kirim alert budget terlampaui. Rate-limited: max 1x per jam via AlertLog check di caller. */
  async sendBudgetAlert(params: {
    totalSpent: number;
    budget: number;
    lastTransaction: { source: string; description: string; amount: number };
  }) {
    const { totalSpent, budget, lastTransaction } = params;
    const over = totalSpent - budget;

    const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

    const text = [
      '⚠️ <b>Budget Harian Terlampaui!</b>',
      '',
      `Hari ini: ${formatRp(totalSpent)} / ${formatRp(budget)}`,
      `Kelebihan: ${formatRp(over)}`,
      '',
      'Transaksi terakhir:',
      `${lastTransaction.source} - ${formatRp(lastTransaction.amount)} (${lastTransaction.description})`,
    ].join('\n');

    return this.sendMessage(text);
  }

  /** Cek toggle notifyEveryTransaction tanpa expose config penuh. */
  async isNotifyEveryTransactionEnabled(): Promise<boolean> {
    const config = await this.prisma.telegramConfig.findFirst({ where: { isActive: true } });
    return !!config?.notifyEveryTransaction;
  }

  /** Notifikasi per transaksi baru masuk — terpisah dari alert over-budget, dua-duanya bisa jalan bareng. */
  async sendTransactionNotif(transaction: {
    source: string;
    description: string;
    amount: number;
    occurredAt: Date;
  }) {
    const { source, description, amount, occurredAt } = transaction;
    const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
    const jam = occurredAt.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    });

    const text = [
      '💸 <b>Transaksi baru</b>',
      '',
      `${formatRp(amount)} — ${description}`,
      `${jam} · ${source}`,
    ].join('\n');

    return this.sendMessage(text);
  }
}
