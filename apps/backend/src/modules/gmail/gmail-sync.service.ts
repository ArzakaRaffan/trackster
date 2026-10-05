import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { GmailAuthService } from './gmail-auth.service';
import { ParserRegistryService } from './parsers/parser-registry.service';
import { RawEmail, ParseResult, htmlToText } from './parsers/parser.interface';
import { TransactionService } from '../transaction/transaction.service';
import { BudgetService } from '../budget/budget.service';
import { TelegramService } from '../telegram/telegram.service';
import { PrismaService } from '../../prisma.service';
import { AiChatService } from '../ai/ai-chat.service';
import { AiCaptionService } from '../ai/ai-caption.service';
import { AiAnomalyService } from '../ai/ai-anomaly.service';
import { MerchantAliasService } from '../merchant-alias/merchant-alias.service';
import { IncomeService } from '../income/income.service';
import { BalanceService, shouldAdjustBalance } from '../balance/balance.service';
import { Category, ParseStatus } from '@prisma/client';
import { shouldSkipLogUpsert } from './parsers/email-parse-log.util';

// Cron window tetap pendek biar ringan. Historical gap pakai syncEmails({ after, before }).
const GMAIL_QUERY_RECENT = 'from:(bca OR jago OR flip OR bni OR bankmandiri OR bankraya OR bankbri@bri.co.id) newer_than:7d';

const SYNC_CRON_JOB_NAME = 'gmail-sync';

export type SyncOptions = {
  /** Inclusive start date YYYY-MM-DD (Asia/Jakarta intent; Gmail after: uses date) */
  after?: string;
  /** Exclusive end date YYYY-MM-DD for Gmail before: */
  before?: string;
  /** Skip Telegram notifications (default true for backfill) */
  quiet?: boolean;
};

@Injectable()
export class GmailSyncService {
  private readonly logger = new Logger(GmailSyncService.name);

  constructor(
    private gmailAuthService: GmailAuthService,
    private parserRegistry: ParserRegistryService,
    private transactionService: TransactionService,
    private budgetService: BudgetService,
    private telegramService: TelegramService,
    private prisma: PrismaService,
    private schedulerRegistry: SchedulerRegistry,
    private aiChatService: AiChatService,
    private aiCaptionService: AiCaptionService,
    private aiAnomalyService: AiAnomalyService,
    private merchantAliasService: MerchantAliasService,
    private incomeService: IncomeService,
    private balanceService: BalanceService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: SYNC_CRON_JOB_NAME })
  async handleCron() {
    // Satu mailbox per user yang punya token (saat ini hanya pemilik). Gagal di satu user tak menghentikan yang lain.
    const tokens = await this.prisma.gmailToken.findMany({ where: { userId: { not: null } }, select: { userId: true } });
    for (const { userId } of tokens) {
      try {
        await this.syncEmails(userId as number);
      } catch (err: any) {
        this.logger.error(`gmail-sync user ${userId} gagal: ${err?.message}`);
      }
    }
  }

  getNextRun(): string {
    const job = this.schedulerRegistry.getCronJob(SYNC_CRON_JOB_NAME);
    const next = job.nextDate();
    return next.toISO() ?? next.toJSDate().toISOString();
  }

  private buildQuery(options?: SyncOptions): string {
    if (options?.after || options?.before) {
      const parts = ['from:(bca OR jago OR flip OR bni OR bankmandiri OR bankraya OR bankbri@bri.co.id)'];
      if (options.after) parts.push(`after:${options.after.replace(/-/g, '/')}`);
      if (options.before) parts.push(`before:${options.before.replace(/-/g, '/')}`);
      return parts.join(' ');
    }
    return GMAIL_QUERY_RECENT;
  }

  async syncEmails(userId: number, options?: SyncOptions) {
    const gmail = await this.gmailAuthService.getGmailClient(userId);
    if (!gmail) {
      this.logger.debug('Gmail belum terhubung, skip sync.');
      return { synced: 0, scanned: 0, query: 'Gmail belum terhubung' };
    }

    const query = this.buildQuery(options);
    const quiet = options?.quiet ?? !!(options?.after || options?.before);

    try {
      const messageIds: string[] = [];
      let pageToken: string | undefined;
      do {
        const listRes = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 100,
          pageToken,
        });
        for (const msg of listRes.data.messages || []) {
          if (msg.id) messageIds.push(msg.id);
        }
        pageToken = listRes.data.nextPageToken || undefined;
      } while (pageToken);

      this.logger.log(`Gmail sync query="${query}" candidates=${messageIds.length}`);

      let syncedCount = 0;
      let syncedIncomeCount = 0;
      let skippedExcluded = 0;
      let skippedUnparsed = 0;
      let skippedDuplicate = 0;
      let newestTransaction: { source: string; description: string; amount: number } | null = null;
      const notifyEveryTransaction =
        !quiet && (await this.telegramService.isNotifyEveryTransactionEnabled(userId));

      for (const id of messageIds) {
        const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
        const { from, subject, receivedAt } = this.extractHeaders(full.data);

        try {
          await this.processMessage(userId, id, full.data, from, subject, receivedAt, notifyEveryTransaction, {
            onRecorded: (t) => {
              syncedCount++;
              newestTransaction = t;
            },
            onIncomeRecorded: () => syncedIncomeCount++,
            onDuplicate: () => skippedDuplicate++,
            onExcluded: () => skippedExcluded++,
            onUnparsed: () => skippedUnparsed++,
          });
        } catch (err: any) {
          this.logger.error(`Gagal proses email ${id}: ${err.message}`);
          await this.logParseResult(userId, id, from, subject, receivedAt, {
            status: ParseStatus.ERROR,
            reason: err.message,
          });
        }
      }

      const summary = `${syncedCount} baru (+${syncedIncomeCount} income) · ${messageIds.length} discan · dup=${skippedDuplicate} skip=${skippedUnparsed} excl=${skippedExcluded}`;
      await this.prisma.emailSyncLog.create({
        data: { userId, lastSyncAt: new Date(), status: 'SUCCESS', message: summary },
      });

      if (!quiet && syncedCount > 0 && newestTransaction) {
        await this.checkAndAlertIfOverBudget(userId, newestTransaction);
      }

      return {
        synced: syncedCount,
        syncedIncome: syncedIncomeCount,
        scanned: messageIds.length,
        skippedDuplicate,
        skippedUnparsed,
        skippedExcluded,
        query,
      };
    } catch (err) {
      this.logger.error(`Gmail sync gagal: ${err.message}`);
      await this.prisma.emailSyncLog.create({
        data: { userId, lastSyncAt: new Date(), status: 'ERROR', message: err.message },
      });
      return { synced: 0, scanned: 0, error: err.message, query };
    }
  }

  private async processMessage(
    userId: number,
    id: string,
    message: any,
    from: string,
    subject: string,
    receivedAt: Date,
    notifyEveryTransaction: boolean,
    callbacks: {
      onRecorded: (t: { source: string; description: string; amount: number }) => void;
      onIncomeRecorded: () => void;
      onDuplicate: () => void;
      onExcluded: () => void;
      onUnparsed: () => void;
    },
  ) {
    // Dedup dulu di sini, sebelum parse ulang — createFromParsed cuma cek Transaction.emailId, yang
    // hilang kalau user hapus transaksinya. EmailParseLog.status RECORDED tetap ada setelah dihapus,
    // jadi ini satu-satunya penanda "email ini sudah pernah diproses" yang bertahan lewat delete.
    // Tanpa ini, cron 5 menit (window 7 hari) bakal bikin ulang transaksi/income yang baru dihapus.
    const existingLog = await this.prisma.emailParseLog.findFirst({ where: { userId, emailId: id } });
    if (existingLog?.status === ParseStatus.RECORDED) {
      callbacks.onDuplicate();
      return;
    }

    const rawEmail = this.extractRawEmail(message);
    if (!rawEmail) {
      callbacks.onUnparsed();
      await this.logParseResult(userId, id, from, subject, receivedAt, {
        status: ParseStatus.UNPARSED,
        reason: 'body kosong / tidak bisa didekode',
      });
      return;
    }

    const { parser, result: parsed } = this.parserRegistry.parseEmailWithSource(rawEmail);
    if (!parsed) {
      callbacks.onUnparsed();
      await this.logParseResult(userId, id, from, subject, receivedAt, {
        status: ParseStatus.UNPARSED,
        reason: 'no parser matched / parser return null',
        parser,
      });
      return;
    }

    if (parsed.kind === 'INCOME') {
      await this.processIncome(userId, id, rawEmail.id, from, subject, receivedAt, parsed, notifyEveryTransaction, parser, callbacks);
      return;
    }

    if (parsed.excluded) {
      this.logger.debug(`Skip (excluded): ${parsed.excludeReason}`);
      callbacks.onExcluded();
      if (parsed.balanceOnly) {
        await this.applyBalanceOnlyDebit(userId, id, parsed);
      }
      await this.logParseResult(userId, id, from, subject, receivedAt, {
        status: ParseStatus.EXCLUDED,
        reason: parsed.excludeReason,
        amount: parsed.amount,
        parser,
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

      await this.logParseResult(userId, id, from, subject, receivedAt, {
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
      await this.logParseResult(userId, id, from, subject, receivedAt, {
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
    id: string,
    emailId: string,
    from: string,
    subject: string,
    receivedAt: Date,
    parsed: ParseResult,
    notifyEveryTransaction: boolean,
    parser: string | null,
    callbacks: { onIncomeRecorded: () => void; onDuplicate: () => void },
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
      await this.logParseResult(userId, id, from, subject, receivedAt, {
        status: ParseStatus.DUPLICATE,
        amount: parsed.amount,
        kind: 'INCOME',
        parser,
      });
      return;
    }

    callbacks.onIncomeRecorded();
    await this.logParseResult(userId, id, from, subject, receivedAt, {
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
  private async applyBalanceOnlyDebit(userId: number, emailId: string, parsed: ParseResult) {
    const existing = await this.prisma.emailParseLog.findFirst({ where: { userId, emailId } });
    if (existing?.status === ParseStatus.EXCLUDED) return;

    await this.prisma.$transaction(async (tx) => {
      const lastAdjustmentAt = await this.balanceService.getLastManualAdjustmentAt(tx, userId, parsed.source);
      if (shouldAdjustBalance(parsed.occurredAt, lastAdjustmentAt)) {
        await this.balanceService.adjustBalance(tx, userId, parsed.source, -parsed.amount);
      }
    });
  }

  /** Pipeline kategorisasi (E00-S3): rule merchant (by merchantKey) → heuristik parser
   * (`categoryHint`) → AI fast, lalu hasil AI disimpan sebagai rule baru biar merchant yang sama
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

    const aiResult = (await this.aiChatService.categorize(description, amount)) as Category;
    if (aiResult !== Category.LAINNYA) {
      await this.merchantAliasService.upsertCategory(userId, description, aiResult);
    }
    return aiResult;
  }

  private async checkAndAlertIfOverBudget(userId: number, lastTransaction: {
    source: string;
    description: string;
    amount: number;
  }) {
    const summary = await this.budgetService.getTodaySummary(userId);
    if (!summary.isOverBudget) return;

    const todayDateOnly = new Date(summary.date);
    const alreadyAlerted = await this.prisma.alertLog.findFirst({ where: { userId, date: todayDateOnly } });
    if (alreadyAlerted) return;

    const sent = await this.telegramService.sendBudgetAlert(userId, {
      totalSpent: summary.totalSpent,
      budget: summary.budget,
      lastTransaction,
    });

    if (sent) {
      await this.prisma.alertLog.create({ data: { userId, date: todayDateOnly } });
    }
  }

  private extractHeaders(message: any): { from: string; subject: string; receivedAt: Date } {
    const headers = message?.payload?.headers || [];
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const internalDate = message?.internalDate ? Number(message.internalDate) : Date.now();
    return { from, subject, receivedAt: new Date(internalDate) };
  }

  /** Upsert EmailParseLog per message — lihat shouldSkipLogUpsert utk kenapa RECORDED nggak boleh ketimpa. */
  private async logParseResult(
    userId: number,
    emailId: string,
    from: string,
    subject: string,
    receivedAt: Date,
    entry: {
      status: ParseStatus;
      reason?: string;
      amount?: number;
      counterparty?: string;
      kind?: string;
      parser?: string | null;
    },
  ) {
    const existing = await this.prisma.emailParseLog.findFirst({ where: { userId, emailId } });
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
    // findFirst + update/create (bukan upsert): unik masih global (emailId) sampai C1 -> (userId, emailId).
    if (existing) {
      await this.prisma.emailParseLog.updateMany({ where: { id: existing.id, userId }, data });
    } else {
      await this.prisma.emailParseLog.create({ data: { userId, emailId, ...data } });
    }
  }

  private extractRawEmail(message: any): RawEmail | null {
    if (!message?.payload) return null;

    const headers = message.payload.headers || [];
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';

    const body = this.extractBody(message.payload);
    if (!body) return null;

    return {
      id: message.id,
      from,
      subject,
      body,
      internalDate: message.internalDate || `${Date.now()}`,
    };
  }

  private extractBody(payload: any): string | null {
    const plainRaw = this.findPartByMimeType(payload, 'text/plain');
    if (plainRaw) return this.decodeBase64(plainRaw);

    const htmlRaw = this.findPartByMimeType(payload, 'text/html');
    if (htmlRaw) return this.htmlToText(this.decodeBase64(htmlRaw));

    return null;
  }

  private findPartByMimeType(payload: any, mimeType: string): string | null {
    if (!payload) return null;

    if (payload.mimeType === mimeType && payload.body?.data) {
      return payload.body.data;
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        const found = this.findPartByMimeType(part, mimeType);
        if (found) return found;
      }
    }

    return null;
  }

  private decodeBase64(data: string): string {
    return Buffer.from(data, 'base64').toString('utf-8');
  }

  private htmlToText(html: string): string {
    return htmlToText(html);
  }
}