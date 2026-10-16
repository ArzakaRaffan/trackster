import { Injectable, Logger } from '@nestjs/common';
import { Source } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { BudgetService } from '../budget/budget.service';
import { TransactionService } from '../transaction/transaction.service';
import { TelegramService, escHtml } from '../telegram/telegram.service';
import { parseQuickLog, QuickLog } from '../telegram/quick-log';
import { IngestService } from './ingest.service';
import { addWibDays, wibDateKey } from '../../common/wib';

const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
const TODAY_CMD = /^\/(hariini|sisa|today)(@\w+)?$/i;
const UNDO_PREFIX = 'qx:';
const UNDO_WINDOW_MS = 24 * 3600_000;

/** Perintah Telegram yang dijawab tanpa AI (instan, tidak memakai kuota): catat cepat "kopi 25rb" (+ tombol Batalkan)
 *  dan /hariini. Pencatatan lewat IngestService → kategori, alert budget, dedup sama dengan Shortcut. */
@Injectable()
export class TelegramQuickService {
  private readonly logger = new Logger(TelegramQuickService.name);

  constructor(
    private prisma: PrismaService,
    private ingestService: IngestService,
    private budgetService: BudgetService,
    private transactionService: TransactionService,
    private telegramService: TelegramService,
  ) {}

  /** Sinkron & murah: dipakai webhook untuk memutuskan jalur sebelum membalas 200 ke Telegram. */
  match(text: string): { kind: 'today' } | { kind: 'log'; q: QuickLog } | null {
    if (TODAY_CMD.test(text.trim())) return { kind: 'today' };
    const q = parseQuickLog(text);
    return q ? { kind: 'log', q } : null;
  }

  async handle(userId: number, chatId: string, messageId: number, m: NonNullable<ReturnType<TelegramQuickService['match']>>) {
    if (m.kind === 'today') return this.telegramService.sendMessage(userId, await this.todayText(userId));

    const { q } = m;
    const source = q.source ?? (await this.defaultSource(userId));
    // Kunci idempotensi = pesan Telegram → webhook yang dikirim ulang tidak mencatat dua kali.
    const key = `tg:${chatId}:${messageId}`;
    // "kemarin" → pukul 12:00 WIB kemarin.
    const when = q.daysAgo ? `${wibDateKey(addWibDays(new Date(), -1))}T12:00:00+07:00` : undefined;
    if (q.kind === 'income') {
      const inc = await this.ingestService.ingestIncome(userId, key, {
        amount: q.amount, description: q.description, streamName: q.description, source, receivedAt: when,
      });
      if (!inc.duplicate) await this.telegramService.sendMessage(userId, `💰 ${escHtml(inc.message)}\n<i>${source}${q.daysAgo ? ' · kemarin' : ''}</i>`);
      return;
    }
    const res = await this.ingestService.ingestTransaction(userId, key, {
      amount: q.amount,
      description: q.description,
      source,
      occurredAt: when,
    });
    if (res.duplicate) return;
    await this.telegramService.sendMessageWithKeyboard(
      userId,
      `✅ ${escHtml(res.message)}\n<i>${source} · ${res.category}${q.daysAgo ? ' · kemarin' : ''}</i>`,
      [[{ text: '↩️ Batalkan', callback_data: `${UNDO_PREFIX}${res.id}` }]],
    );
  }

  isUndo(data: unknown): data is string {
    return typeof data === 'string' && data.startsWith(UNDO_PREFIX);
  }

  /** Tombol "Batalkan": hanya transaksi hasil catat cepat Telegram milik user ini, maks 24 jam. */
  async undo(userId: number, cq: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } }) {
    const id = Number(cq.data!.slice(UNDO_PREFIX.length));
    const tx = Number.isInteger(id)
      ? await this.prisma.transaction.findFirst({ where: { id, userId, emailId: { startsWith: 'ing:tg:' } } })
      : null;
    if (!tx || Date.now() - tx.createdAt.getTime() > UNDO_WINDOW_MS) {
      await this.telegramService.answerCallbackQuery(userId, cq.id, 'Tidak bisa dibatalkan lagi');
      return;
    }
    await this.transactionService.remove(userId, tx.id);
    await this.telegramService.answerCallbackQuery(userId, cq.id, 'Dibatalkan');
    if (cq.message) {
      await this.telegramService.editMessage(
        userId,
        String(cq.message.chat.id),
        cq.message.message_id,
        `↩️ Dibatalkan: ${escHtml(tx.description)} ${rupiah(Number(tx.amount))}`,
      );
    }
  }

  private async defaultSource(userId: number): Promise<Source> {
    const last = await this.prisma.transaction.findFirst({ where: { userId }, orderBy: { occurredAt: 'desc' }, select: { source: true } });
    if (last) return last.source;
    const bal = await this.prisma.bankBalance.findFirst({ where: { userId }, orderBy: { id: 'asc' }, select: { source: true } });
    return bal?.source ?? Source.BCA;
  }

  private async todayText(userId: number): Promise<string> {
    const s = await this.budgetService.getTodaySummary(userId);
    const spent = s.totalSpent - s.bigSpent;
    const lines = [
      `<b>Hari ini</b> · ${s.date}`,
      `Belanja ${rupiah(spent)} dari jatah ${rupiah(s.budget)}`,
      s.remaining >= 0 ? `Sisa <b>${rupiah(s.remaining)}</b> ✅` : `Lewat <b>${rupiah(-s.remaining)}</b> ⚠️`,
    ];
    if (s.bigSpent > 0) lines.push(`Pembelian besar ${rupiah(s.bigSpent)} (tidak dihitung di jatah harian)`);
    if (s.cycle) {
      lines.push(
        s.cycle.mode === 'CYCLE'
          ? `Sisa siklus ${rupiah(s.cycle.remaining)} · ${s.cycle.daysLeft} hari lagi sampai gajian`
          : `Saldo tersedia ${rupiah(s.cycle.remaining)}${s.cycle.runwayDays != null ? ` · cukup ±${s.cycle.runwayDays} hari` : ''}`,
      );
    }
    if (s.totalIncome > 0) lines.push(`Pemasukan hari ini ${rupiah(s.totalIncome)}`);
    lines.push('', '<i>Catat cepat: "kopi 25rb", "bensin 50rb jago kemarin", pemasukan "+gaji 5jt".</i>');
    return lines.join('\n');
  }
}
