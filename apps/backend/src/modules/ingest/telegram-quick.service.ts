import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Source } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { BudgetService } from '../budget/budget.service';
import { TransactionService } from '../transaction/transaction.service';
import { TelegramService, escHtml } from '../telegram/telegram.service';
import { parseAmount, parseQuickLog, QuickLog } from '../telegram/quick-log';
import { affordability } from '../budget/affordability';
import { IngestService } from './ingest.service';
import { addWibDays, startOfWibDay, wibDateKey } from '../../common/wib';
import { forEachActiveUser } from '../../common/per-user';
import { spend } from '../../common/spend';
import { dueDatesBetween } from '../subscription/subscription-due';

const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
const TODAY_CMD = /^\/(hariini|sisa|today)(@\w+)?$/i;
const BRIEF_CMD = /^\/pagi(@\w+)?$/i;
const AFFORD_CMD = /^\/bisa(@\w+)?(?:\s+(.*))?$/i;
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
  match(text: string): { kind: 'today' } | { kind: 'brief' } | { kind: 'afford'; amount: number | null } | { kind: 'log'; q: QuickLog } | null {
    if (TODAY_CMD.test(text.trim())) return { kind: 'today' };
    if (BRIEF_CMD.test(text.trim())) return { kind: 'brief' };
    const af = AFFORD_CMD.exec(text.trim());
    if (af) {
      const rest = (af[2] || '').trim();
      return { kind: 'afford', amount: parseQuickLog(`/catat ${rest}`)?.amount ?? parseAmount(rest.replace(/\s+/g, ''))?.value ?? null };
    }
    const q = parseQuickLog(text);
    return q ? { kind: 'log', q } : null;
  }

  async handle(userId: number, chatId: string, messageId: number, m: NonNullable<ReturnType<TelegramQuickService['match']>>) {
    if (m.kind === 'today') return this.telegramService.sendMessage(userId, await this.todayText(userId));
    if (m.kind === 'afford') return this.telegramService.sendMessage(userId, await this.affordText(userId, m.amount));
    if (m.kind === 'brief') {
      const on = !(await this.telegramService.isDailyBriefEnabled(userId));
      await this.telegramService.setDailyBrief(userId, on);
      return this.telegramService.sendMessage(
        userId,
        on ? '☀️ Ringkasan pagi <b>nyala</b>: tiap 07:00 aku kirim jatah hari ini, belanja kemarin, dan tagihan yang jatuh tempo. Kirim /pagi lagi untuk mematikan.' : 'Ringkasan pagi <b>mati</b>. Kirim /pagi untuk menyalakan lagi.',
      );
    }

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

  /** /bisa 350rb — dampak pembelian ke jatah sebelum belanja (tanpa mencatat apa pun). */
  async affordText(userId: number, amount: number | null): Promise<string> {
    if (!amount || amount < 100) return 'Contoh: <code>/bisa 350rb</code> atau <code>/bisa sepatu 450rb</code> — aku hitung dampaknya ke jatahmu tanpa mencatat apa pun.';
    const s = await this.budgetService.getTodaySummary(userId);
    const a = affordability(s, amount);
    const head = `Kalau belanja <b>${rupiah(amount)}</b> sekarang:`;
    if (a.verdict === 'TODAY') return `${head}\n✅ Masih masuk jatah hari ini — sisa jadi ${rupiah(a.leftToday)}.`;
    if (a.verdict === 'OVER_TODAY') return `${head}\n⚠️ Lewat jatah hari ini ${rupiah(a.overBy)} (jatah ${rupiah(s.budget)}).`;
    if (a.verdict === 'SHORT') return `${head}\n⛔ Uang ${s.cycle?.mode === 'CYCLE' ? 'sampai gajian' : 'tersedia'} kurang ${rupiah(a.shortBy)}.`;
    return `${head}\nJatah ${a.days} hari ke depan turun dari ${rupiah(a.perDayBefore)} ke <b>${rupiah(a.perDayAfter)}</b>/hari.`;
  }

  /** 07:00 WIB — ringkasan pagi untuk user yang menyalakan /pagi. */
  @Cron('0 7 * * *', { name: 'telegram-daily-brief', timeZone: 'Asia/Jakarta' })
  async dailyBriefCron() {
    await forEachActiveUser(this.prisma, this.logger, 'telegram-daily-brief', async (userId) => {
      if (await this.telegramService.isDailyBriefEnabled(userId)) await this.telegramService.sendMessage(userId, await this.briefText(userId));
    }, { jitterMs: 2000 });
  }

  async briefText(userId: number): Promise<string> {
    const now = new Date();
    const todayStart = startOfWibDay(now);
    const todayKey = wibDateKey(now);
    const [s, yTx, subs] = await Promise.all([
      this.budgetService.getTodaySummary(userId),
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: addWibDays(todayStart, -1), lt: todayStart } },
        select: { amount: true, reimbursedAmount: true },
      }),
      this.prisma.subscription.findMany({ where: { userId, isActive: true }, select: { name: true, amount: true, cycle: true, nextDueDate: true } }),
    ]);
    const ySpent = yTx.reduce((a, t) => a + spend(t), 0);
    const tomorrowKey = wibDateKey(addWibDays(todayStart, 1));
    const dueToday = subs.filter((x) => dueDatesBetween(x.nextDueDate, x.cycle, todayKey, tomorrowKey).length);
    const lines = [
      '☀️ <b>Selamat pagi!</b>',
      `Jatah hari ini <b>${rupiah(s.budget)}</b>`,
      yTx.length ? `Kemarin belanja ${rupiah(ySpent)} (${yTx.length} transaksi)` : 'Kemarin tidak ada belanja tercatat 🎉',
    ];
    for (const x of dueToday) lines.push(`🔁 ${escHtml(x.name)} ${rupiah(Number(x.amount))} jatuh tempo hari ini`);
    if (s.cycle?.mode === 'CYCLE') lines.push(`Sisa siklus ${rupiah(s.cycle.remaining)} · ${s.cycle.daysLeft} hari lagi sampai gajian`);
    lines.push('', '<i>Catat: "kopi 25rb" · cek sisa: /hariini · matikan: /pagi</i>');
    return lines.join('\n');
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
    lines.push('', '<i>Catat cepat: "kopi 25rb", "bensin 50rb jago kemarin", pemasukan "+gaji 5jt". Sebelum belanja: /bisa 350rb</i>');
    return lines.join('\n');
  }
}
