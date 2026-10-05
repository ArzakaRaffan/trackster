import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { PrismaService } from '../../prisma.service';
import { TelegramConfigDto } from './dto/telegram-config.dto';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private prisma: PrismaService) {}

  private activeConfig(userId: number) {
    return this.prisma.telegramConfig.findFirst({ where: { userId, isActive: true } });
  }

  async getConfig(userId: number) {
    const config = await this.prisma.telegramConfig.findFirst({ where: { userId } });
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
  async updateConfig(userId: number, dto: TelegramConfigDto) {
    // Satu chat = satu user: webhook memetakan chatId -> userId, jadi chatId tidak boleh dipakai dua user.
    if (dto.chatId) {
      // tenancy-ok: cek keunikan lintas user (sengaja tanpa userId)
      const taken = await this.prisma.telegramConfig.findFirst({ where: { chatId: dto.chatId, userId: { not: userId } } });
      if (taken) throw new BadRequestException('Chat ID ini sudah dipakai akun lain');
    }
    const existing = await this.prisma.telegramConfig.findFirst({ where: { userId } });
    if (existing) {
      await this.prisma.telegramConfig.updateMany({
        where: { id: existing.id, userId },
        data: {
          ...(dto.botToken !== undefined && { botToken: dto.botToken }),
          ...(dto.chatId !== undefined && { chatId: dto.chatId }),
          ...(dto.notifyEveryTransaction !== undefined && { notifyEveryTransaction: dto.notifyEveryTransaction }),
          isActive: true,
        },
      });
      return this.prisma.telegramConfig.findFirstOrThrow({ where: { id: existing.id, userId } });
    }
    return this.prisma.telegramConfig.create({
      data: {
        userId,
        botToken: dto.botToken ?? '',
        chatId: dto.chatId ?? '',
        notifyEveryTransaction: dto.notifyEveryTransaction ?? false,
        isActive: true,
      },
    });
  }

  async sendMessage(userId: number, text: string): Promise<boolean> {
    const config = await this.activeConfig(userId);
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
    userId: number,
    text: string,
    keyboard: TelegramBot.InlineKeyboardButton[][],
  ): Promise<{ chatId: string; messageId: number } | null> {
    const config = await this.activeConfig(userId);
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
  async editMessage(userId: number, chatId: string, messageId: number, text: string, keyboard?: TelegramBot.InlineKeyboardButton[][]) {
    const config = await this.activeConfig(userId);
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

  async answerCallbackQuery(userId: number, callbackQueryId: string, text?: string) {
    const config = await this.activeConfig(userId);
    if (!config) return;

    try {
      const bot = new TelegramBot(config.botToken, { polling: false });
      await bot.answerCallbackQuery(callbackQueryId, text ? { text } : undefined);
    } catch (err) {
      this.logger.error(`Gagal answerCallbackQuery Telegram: ${err.message}`);
    }
  }

  /** Webhook: chatId -> config (dan userId pemiliknya). Hanya internal (validasi webhook), JANGAN expose ke endpoint publik. */
  async getConfigByChatId(chatId: string) {
    // tenancy-ok: kunci pencarian = chatId; hasilnya MENENTUKAN userId untuk seluruh handler webhook
    return this.prisma.telegramConfig.findFirst({ where: { chatId, isActive: true } });
  }

  async sendTest(userId: number) {
    const success = await this.sendMessage(userId, '✅ Test notifikasi dari Trackster berhasil!');
    return { success };
  }

  /** Kirim alert budget terlampaui. Rate-limited: max 1x per jam via AlertLog check di caller. */
  async sendBudgetAlert(userId: number, params: {
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

    return this.sendMessage(userId, text);
  }

  /** Cek toggle notifyEveryTransaction tanpa expose config penuh. */
  async isNotifyEveryTransactionEnabled(userId: number): Promise<boolean> {
    const config = await this.activeConfig(userId);
    return !!config?.notifyEveryTransaction;
  }

  /** Notifikasi per transaksi baru masuk — terpisah dari alert over-budget, dua-duanya bisa jalan bareng. */
  async sendTransactionNotif(userId: number, transaction: {
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

    return this.sendMessage(userId, text);
  }

  /** Notifikasi dana masuk otomatis (E02-S1, Jago "menerima uang" dkk) — pola sama dengan sendTransactionNotif. */
  async sendIncomeNotif(userId: number, income: { source: string; sender: string; amount: number; occurredAt: Date }) {
    const { source, sender, amount, occurredAt } = income;
    const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
    const jam = occurredAt.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    });

    const text = [
      '💰 <b>Pemasukan baru</b>',
      '',
      `${formatRp(amount)} dari ${sender}`,
      `${jam} · ${source}`,
    ].join('\n');

    return this.sendMessage(userId, text);
  }
}
