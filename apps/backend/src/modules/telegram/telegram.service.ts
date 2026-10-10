import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { getOwnerUserId } from '../../common/owner';
import { TelegramConfigDto } from './dto/telegram-config.dto';

export type InlineKeyboardButton = { text: string; callback_data?: string; url?: string };

/** Panggil Bot API langsung (fetch) — pengganti node-telegram-bot-api yang membawa dependensi `request` usang & rentan.
 * Token tak pernah masuk pesan error/log. */
async function tgCall<T = any>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
  if (!/^\d+:[\w-]+$/.test(token)) throw new Error('format bot token tidak valid');
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json: any = await res.json().catch(() => null);
  if (!json?.ok) throw new Error(`${method} gagal: ${json?.description ?? res.status}`);
  return json.result as T;
}

/** Pesan dikirim dgn parse_mode HTML: teks dari email bank / AI / user WAJIB lewat ini supaya tak bisa menyisipkan tag (mis. link phishing). */
export const escHtml = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Tujuan kirim untuk user: chat dari TelegramLink (bot bersama) atau, selama belum ditautkan, TelegramConfig lama.
   * Token = env TELEGRAM_BOT_TOKEN (bot bersama); fallback ke token tersimpan di config lama supaya pemilik tetap jalan
   * sebelum env diverifikasi. ponytail: hapus fallback + TelegramConfig di langkah contract (C1).
   */
  private async activeConfig(userId: number) {
    const [link, legacy] = await Promise.all([
      this.prisma.telegramLink.findFirst({ where: { userId, isActive: true } }),
      this.prisma.telegramConfig.findFirst({ where: { userId, isActive: true } }),
    ]);
    const chatId = link?.chatId ?? legacy?.chatId;
    const botToken = process.env.TELEGRAM_BOT_TOKEN || legacy?.botToken;
    if (!chatId || !botToken) return null;
    return { botToken, chatId, notifyEveryTransaction: link ? link.notifyEveryTransaction : !!legacy?.notifyEveryTransaction };
  }

  /** Buat kode tautan sekali pakai (15 menit): user kirim `/start <kode>` ke bot bersama. Hanya hash yang disimpan. */
  async createLinkCode(userId: number) {
    const code = randomBytes(5).toString('hex').toUpperCase();
    await this.prisma.telegramLinkCode.create({
      data: { userId, codeHash: this.hashCode(code), expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    });
    return { code, expiresInMinutes: 15 };
  }

  private hashCode(code: string) {
    return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  }

  /** Dipanggil webhook saat chat mengirim `/start <kode>`. Return userId bila berhasil, null bila kode salah/kedaluwarsa. */
  async linkChatByCode(chatId: string, code: string): Promise<number | null> {
    // tenancy-ok: kunci pencarian = hash kode rahasia; hasilnya menentukan userId yang ditautkan
    const row = await this.prisma.telegramLinkCode.findFirst({
      where: { codeHash: this.hashCode(code), usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!row) return null;
    // tenancy-ok: cek keunikan chat lintas user
    const taken = await this.prisma.telegramLink.findFirst({ where: { chatId, userId: { not: row.userId } } });
    if (taken) return null;
    await this.prisma.$transaction([
      this.prisma.telegramLinkCode.updateMany({ where: { id: row.id, userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.telegramLink.upsert({
        where: { userId: row.userId },
        create: { userId: row.userId, chatId },
        update: { chatId, isActive: true },
      }),
    ]);
    return row.userId;
  }

  /** Balas langsung ke chat (sebelum chat ditautkan ke user mana pun). */
  async sendToChat(chatId: string, text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    try {
      await tgCall(token, 'sendMessage', { chat_id: chatId, text });
    } catch (err) {
      this.logger.error(`Gagal balas Telegram: ${err.message}`);
    }
  }

  async getConfig(userId: number) {
    const [config, link] = await Promise.all([
      this.prisma.telegramConfig.findFirst({ where: { userId } }),
      this.prisma.telegramLink.findFirst({ where: { userId } }),
    ]);
    if (link) return { configured: true, linked: true, isActive: link.isActive, chatId: link.chatId, notifyEveryTransaction: link.notifyEveryTransaction };
    if (!config) return { configured: false, linked: false, notifyEveryTransaction: false };
    return {
      configured: true,
      linked: false,
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
    if (dto.chatId !== undefined || dto.botToken !== undefined) {
      // Config lama (chatId diketik bebas) tidak membuktikan kepemilikan chat: user lain bisa menyuruh bot bersama mengirim
      // pesan ke chat siapa pun. Hanya pemilik (jalur legacy); user lain wajib tautan `/start <kode>` (createLinkCode).
      if ((await getOwnerUserId(this.prisma)) !== userId) {
        throw new ForbiddenException('Hubungkan Telegram lewat kode tautan (Setting → Telegram), bukan chat ID manual.');
      }
      // Satu chat = satu user: webhook memetakan chatId -> userId, jadi chatId tidak boleh dipakai dua user.
      if (dto.chatId) {
        // tenancy-ok: cek keunikan lintas user (sengaja tanpa userId), di config lama DAN tautan bot bersama
        const [cfg, link] = await Promise.all([
          this.prisma.telegramConfig.findFirst({ where: { chatId: dto.chatId, userId: { not: userId } } }),
          this.prisma.telegramLink.findFirst({ where: { chatId: dto.chatId, userId: { not: userId } } }),
        ]);
        if (cfg || link) throw new BadRequestException('Chat ID ini sudah dipakai akun lain');
      }
    }
    if (dto.notifyEveryTransaction !== undefined) {
      await this.prisma.telegramLink.updateMany({ where: { userId }, data: { notifyEveryTransaction: dto.notifyEveryTransaction } });
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
      await tgCall(config.botToken, 'sendMessage', { chat_id: config.chatId, text, parse_mode: 'HTML' });
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
    keyboard: InlineKeyboardButton[][],
  ): Promise<{ chatId: string; messageId: number } | null> {
    const config = await this.activeConfig(userId);
    if (!config) {
      this.logger.warn('Telegram belum dikonfigurasi, skip kirim pesan.');
      return null;
    }

    try {
      const sent = await tgCall<{ message_id: number }>(config.botToken, 'sendMessage', {
        chat_id: config.chatId,
        text,
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
  async editMessage(userId: number, chatId: string, messageId: number, text: string, keyboard?: InlineKeyboardButton[][]) {
    const config = await this.activeConfig(userId);
    if (!config) return;

    try {
      await tgCall(config.botToken, 'editMessageText', {
        text,
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
      await tgCall(config.botToken, 'answerCallbackQuery', { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
    } catch (err) {
      this.logger.error(`Gagal answerCallbackQuery Telegram: ${err.message}`);
    }
  }

  /** Webhook: chatId -> {userId} (TelegramLink, fallback config lama). Hanya internal, JANGAN expose ke endpoint publik. */
  async getConfigByChatId(chatId: string): Promise<{ userId: number } | null> {
    // tenancy-ok: kunci pencarian = chatId; hasilnya MENENTUKAN userId untuk seluruh handler webhook
    const link = await this.prisma.telegramLink.findFirst({ where: { chatId, isActive: true } });
    if (link) return { userId: link.userId };
    // tenancy-ok: kunci = chatId (fallback config lama)
    const legacy = await this.prisma.telegramConfig.findFirst({ where: { chatId, isActive: true } });
    return legacy?.userId ? { userId: legacy.userId } : null;
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
      `${escHtml(lastTransaction.source)} - ${formatRp(lastTransaction.amount)} (${escHtml(lastTransaction.description)})`,
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
      `${formatRp(amount)} — ${escHtml(description)}`,
      `${jam} · ${escHtml(source)}`,
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
      `${formatRp(amount)} dari ${escHtml(sender)}`,
      `${jam} · ${escHtml(source)}`,
    ].join('\n');

    return this.sendMessage(userId, text);
  }
}
