import { Injectable, Logger } from '@nestjs/common';
import { Category, ParseStatus, Prisma } from '@prisma/client';
import { ParserRegistryService } from './parsers/parser-registry.service';
import { RawEmail, ParseResult, looksTransactional } from './parsers/parser.interface';
import { TransactionService } from '../transaction/transaction.service';
import { BudgetService } from '../budget/budget.service';
import { bigPurchaseImpact } from '../budget/budget-cycle';
import { TelegramService } from '../telegram/telegram.service';
import { PrismaService } from '../../prisma.service';
import { getOwnerContext } from '../../common/owner';
import { AiChatService } from '../ai/ai-chat.service';
import { AiCaptionService } from '../ai/ai-caption.service';
import { AiAnomalyService } from '../ai/ai-anomaly.service';
import { MerchantAliasService } from '../merchant-alias/merchant-alias.service';
import { IncomeService } from '../income/income.service';
import { BalanceService } from '../balance/balance.service';
import { shouldSkipLogUpsert } from './parsers/email-parse-log.util';

export type PipelineCallbacks = {
  onRecorded: (t: { source: string; description: string; amount: number }) => void;
  onIncomeRecorded: () => void;
  onDuplicate: () => void;
  onExcluded: () => void;
  onUnparsed: () => void;
};

export type MailMeta = { from: string; subject: string; receivedAt: Date };

/**
 * Pipeline email -> parse -> exclude/balanceOnly/income/expense -> saldo -> kategori -> Telegram.
 * Satu implementasi untuk semua pintu email: Gmail sync (owner, sementara) dan inbound forwarding (F7).
 * `emailId` = kunci dedup (Gmail message ID, atau `fwd:<hash>` untuk inbound).
 */
@Injectable()
export class EmailPipelineService {
  private readonly logger = new Logger(EmailPipelineService.name);

  constructor(
    private parserRegistry: ParserRegistryService,
    private transactionService: TransactionService,
    private budgetService: BudgetService,
    private telegramService: TelegramService,
    private prisma: PrismaService,
    private aiChatService: AiChatService,
    private aiCaptionService: AiCaptionService,
    private aiAnomalyService: AiAnomalyService,
    private merchantAliasService: MerchantAliasService,
    private incomeService: IncomeService,
    private balanceService: BalanceService,
  ) {}

  /**
   * `shadow` = parse + catat EmailParseLog (status SHADOW) saja; TIDAK menulis Transaction/Income/saldo
   * dan tidak mengirim notifikasi. Dipakai membandingkan hasil forwarding vs Gmail sebelum cutover.
   */
  async process(
    userId: number,
    emailId: string,
    rawEmail: RawEmail | null,
    meta: MailMeta,
    notifyEveryTransaction: boolean,
    callbacks: PipelineCallbacks,
    opts?: { shadow?: boolean },
  ) {
    const { from, subject, receivedAt } = meta;
    // Dedup dulu di sini, sebelum parse ulang — createFromParsed cuma cek Transaction.emailId, yang
    // hilang kalau user hapus transaksinya. EmailParseLog.status RECORDED tetap ada setelah dihapus,
    // jadi ini satu-satunya penanda "email ini sudah pernah diproses" yang bertahan lewat delete.
    // Tanpa ini, cron 5 menit (window 7 hari) bakal bikin ulang transaksi/income yang baru dihapus.
    const existingLog = await this.prisma.emailParseLog.findFirst({ where: { userId, emailId } });
    if (existingLog?.status === ParseStatus.RECORDED) {
      callbacks.onDuplicate();
      return;
    }

    if (!rawEmail) {
      callbacks.onUnparsed();
      await this.logParseResult(userId, emailId, meta, {
        status: ParseStatus.UNPARSED,
        reason: 'body kosong / tidak bisa didekode',
      });
      return;
    }

    const { parser, result: parsed } = this.parserRegistry.parseEmailWithSource(rawEmail, await getOwnerContext(this.prisma, userId));
    if (!parsed && !looksTransactional(subject, rawEmail.body)) {
      // Promo/info dari domain bank (mis. "Menang Banyak Hadiah..."): bukan gagal dibaca, jangan tandai "Perlu dicek".
      callbacks.onExcluded();
      await this.logParseResult(userId, emailId, meta, {
        status: opts?.shadow ? ParseStatus.SHADOW : ParseStatus.EXCLUDED,
        reason: opts?.shadow ? 'would: EXCLUDED (bukan notifikasi transaksi)' : 'bukan notifikasi transaksi (promo/info)',
        parser,
      });
      return;
    }
    if (!parsed) {
      callbacks.onUnparsed();
      await this.logParseResult(userId, emailId, meta, {
        status: opts?.shadow ? ParseStatus.SHADOW : ParseStatus.UNPARSED,
        reason: opts?.shadow ? 'would: UNPARSED (no parser matched / parser return null)' : 'no parser matched / parser return null',
        parser,
      });
      return;
    }

    if (opts?.shadow) {
      const would = parsed.kind === 'INCOME' ? 'INCOME' : parsed.excluded ? `EXCLUDED${parsed.balanceOnly ? '+balanceOnly' : ''}` : 'EXPENSE';
      await this.logParseResult(userId, emailId, meta, {
        status: ParseStatus.SHADOW,
        reason: `would: ${would} ${parsed.source}${parsed.excludeReason ? ` (${parsed.excludeReason})` : ''}`,
        amount: parsed.amount,
        counterparty: parsed.description,
        kind: parsed.kind === 'INCOME' ? 'INCOME' : 'EXPENSE',
        parser,
      });
      return;
    }

    if (parsed.kind === 'INCOME') {
      await this.processIncome(userId, emailId, meta, parsed, notifyEveryTransaction, parser, callbacks);
      return;
    }

    if (parsed.excluded) {
      this.logger.debug(`Skip (excluded): ${parsed.excludeReason}`);
      callbacks.onExcluded();
      const log = { status: ParseStatus.EXCLUDED, reason: parsed.excludeReason, amount: parsed.amount, parser };
      if (!parsed.balanceOnly) return this.logParseResult(userId, emailId, meta, log);
      // Debit + log EXCLUDED (penanda "sudah didebit") satu transaksi: crash di antaranya dulu → debit diulang sync berikutnya.
      await this.prisma.$transaction(async (tx) => {
        await this.applyBalanceOnlyDebit(tx, userId, emailId, parsed);
        await this.logParseResult(userId, emailId, meta, log, tx);
      });
      return;
    }

    const category = await this.resolveCategory(userId, parsed.description, parsed.amount, parsed.categoryHint);

    const created = await this.transactionService.createFromParsed(userId, {
      amount: parsed.amount,
      description: parsed.description,
      source: parsed.source,
      emailId: rawEmail.id,
      occurredAt: parsed.occurredAt,
      category,
    });

    if (created) {
      callbacks.onRecorded({ source: parsed.source, description: parsed.description, amount: parsed.amount });

      // Fire-and-forget — kosmetik/proaktif, tidak boleh menahan atau menggagalkan sync.
      const captionable = {
        id: created.id,
        description: created.description,
        amount: Number(created.amount),
        category: created.category,
        occurredAt: created.occurredAt,
        merchantKey: created.merchantKey,
      };
      this.aiCaptionService.generate(userId, captionable).catch(() => {});
      this.aiAnomalyService.checkAndNotify(userId, captionable).catch(() => {});

      await this.logParseResult(userId, emailId, meta, {
        status: ParseStatus.RECORDED,
        amount: parsed.amount,
        counterparty: parsed.description,
        kind: 'EXPENSE',
        parser,
      });

      if (notifyEveryTransaction) {
        await this.telegramService.sendTransactionNotif(userId, {
          source: parsed.source,
          description: parsed.description,
          amount: parsed.amount,
          occurredAt: parsed.occurredAt,
        });
      }
    } else {
      callbacks.onDuplicate();
      await this.logParseResult(userId, emailId, meta, {
        status: ParseStatus.DUPLICATE,
        amount: parsed.amount,
        parser,
      });
    }
  }

  /** Dana masuk (Jago "menerima uang", dst) — route ke IncomeService, bukan TransactionService.
   * Selalu masuk sebagai Income (CONFIRMED/INTERNAL/PENDING, lihat IncomeService.classify), saldo
   * source SELALU gerak terlepas status-nya. */
  private async processIncome(
    userId: number,
    emailId: string,
    meta: MailMeta,
    parsed: ParseResult,
    notifyEveryTransaction: boolean,
    parser: string | null,
    callbacks: Pick<PipelineCallbacks, 'onIncomeRecorded' | 'onDuplicate'>,
  ) {
    const created = await this.incomeService.createFromParsed(userId, {
      amount: parsed.amount,
      description: parsed.description,
      source: parsed.source,
      occurredAt: parsed.occurredAt,
      emailId,
    });

    if (!created) {
      callbacks.onDuplicate();
      await this.logParseResult(userId, emailId, meta, {
        status: ParseStatus.DUPLICATE,
        amount: parsed.amount,
        kind: 'INCOME',
        parser,
      });
      return;
    }

    callbacks.onIncomeRecorded();
    await this.logParseResult(userId, emailId, meta, {
      status: ParseStatus.RECORDED,
      amount: parsed.amount,
      counterparty: parsed.description,
      kind: 'INCOME',
      parser,
    });

    if (notifyEveryTransaction) {
      await this.telegramService.sendIncomeNotif(userId, {
        source: parsed.source,
        sender: parsed.description,
        amount: parsed.amount,
        occurredAt: parsed.occurredAt,
      });
    }
  }

  /** Transfer ke rekening sendiri (BCA/Jago langsung, atau via Flip) — bukan expense, tapi uangnya
   * beneran keluar dari `source` sekarang. Debit saldo sekali per email (dedup: kalau EmailParseLog
   * emailId ini sudah berstatus EXCLUDED dari sync sebelumnya, jangan diterapkan lagi — repeated
   * cron scan tidak boleh dobel-debit). Aturan baseline (koreksi manual) tetap berlaku. */
  private async applyBalanceOnlyDebit(tx: Prisma.TransactionClient, userId: number, emailId: string, parsed: ParseResult) {
    const existing = await tx.emailParseLog.findFirst({ where: { userId, emailId } });
    if (existing?.status === ParseStatus.EXCLUDED) return;
    await this.balanceService.adjustAfterBaseline(tx, userId, parsed.source, parsed.occurredAt, -parsed.amount);
  }

  /** Pipeline kategorisasi (E00-S3): rule merchant (by merchantKey) → heuristik parser
   * (`categoryHint`) → riwayat merchant yang sama → AI fast, lalu hasil AI disimpan sebagai rule baru biar merchant yang sama
   * ke depannya konsisten tanpa panggil AI lagi. */
  private async resolveCategory(
    userId: number,
    description: string,
    amount: number,
    categoryHint?: Category,
  ): Promise<Category> {
    const rule = await this.merchantAliasService.findCategoryForDescription(userId, description);
    if (rule) return rule;

    if (categoryHint) return categoryHint;

    const fromHistory = await this.merchantAliasService.findCategoryFromHistory(userId, description);
    if (fromHistory) return fromHistory;

    const aiResult = (await this.aiChatService.categorize(description, amount)) as Category;
    if (aiResult !== Category.LAINNYA) {
      await this.merchantAliasService.upsertCategory(userId, description, aiResult);
    }
    return aiResult;
  }

  async checkAndAlertIfOverBudget(userId: number, lastTransaction: {
    source: string;
    description: string;
    amount: number;
  }) {
    const summary = await this.budgetService.getTodaySummary(userId);
    // ponytail: hanya transaksi terbaru satu batch yang dicek; pembelian besar lain di batch yang sama tidak dapat notifikasi.
    const impact = bigPurchaseImpact(summary, lastTransaction.amount);
    if (impact) await this.telegramService.sendBigPurchaseNotice(userId, { ...impact, lastTransaction });
    if (!summary.isOverBudget) return;

    const todayDateOnly = new Date(summary.date);
    const alreadyAlerted = await this.prisma.alertLog.findFirst({ where: { userId, date: todayDateOnly } });
    if (alreadyAlerted) return;

    const sent = await this.telegramService.sendBudgetAlert(userId, {
      totalSpent: summary.totalSpent - summary.bigSpent,
      budget: summary.budget,
      lastTransaction,
    });

    if (sent) {
      await this.prisma.alertLog.create({ data: { userId, date: todayDateOnly } });
    }
  }

  /** Upsert EmailParseLog per message — lihat shouldSkipLogUpsert utk kenapa RECORDED nggak boleh ketimpa. */
  async logParseResult(
    userId: number,
    emailId: string,
    { from, subject, receivedAt }: MailMeta,
    entry: {
      status: ParseStatus;
      reason?: string;
      amount?: number;
      counterparty?: string;
      kind?: string;
      parser?: string | null;
    },
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const existing = await db.emailParseLog.findFirst({ where: { userId, emailId } });
    if (shouldSkipLogUpsert(existing?.status ?? null)) return;

    const data = {
      from,
      subject,
      receivedAt,
      status: entry.status,
      reason: entry.reason,
      amount: entry.amount,
      counterparty: entry.counterparty,
      kind: entry.kind,
      parser: entry.parser ?? undefined,
    };
    if (existing) {
      await db.emailParseLog.updateMany({ where: { id: existing.id, userId }, data });
    } else {
      await db.emailParseLog.create({ data: { userId, emailId, ...data } });
    }
  }
}
