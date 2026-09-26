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
import { MerchantAliasService } from '../merchant-alias/merchant-alias.service';
import { IncomeService } from '../income/income.service';
import { BalanceService, shouldAdjustBalance } from '../balance/balance.service';
import { Category, ParseStatus } from '@prisma/client';
import { shouldSkipLogUpsert } from './parsers/email-parse-log.util';

// Cron window tetap pendek biar ringan. Historical gap pakai syncEmails({ after, before }).
const GMAIL_QUERY_RECENT = 'from:(bca OR jago OR flip) newer_than:7d';

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
    private merchantAliasService: MerchantAliasService,
    private incomeService: IncomeService,
    private balanceService: BalanceService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: SYNC_CRON_JOB_NAME })
  async handleCron() {
    await this.syncEmails();
  }

  getNextRun(): string {
    const job = this.schedulerRegistry.getCronJob(SYNC_CRON_JOB_NAME);
    const next = job.nextDate();
    return next.toISO() ?? next.toJSDate().toISOString();
  }

  private buildQuery(options?: SyncOptions): string {
    if (options?.after || options?.before) {
      const parts = ['from:(bca OR jago OR flip)'];
      if (options.after) parts.push(`after:${options.after.replace(/-/g, '/')}`);
      if (options.before) parts.push(`before:${options.before.replace(/-/g, '/')}`);
      return parts.join(' ');
    }
    return GMAIL_QUERY_RECENT;
  }

  async syncEmails(options?: SyncOptions) {
    const gmail = await this.gmailAuthService.getGmailClient();
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
        !quiet && (await this.telegramService.isNotifyEveryTransactionEnabled());

      for (const id of messageIds) {
        const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
        const { from, subject, receivedAt } = this.extractHeaders(full.data);

        try {
          await this.processMessage(id, full.data, from, subject, receivedAt, notifyEveryTransaction, {
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
          await this.logParseResult(id, from, subject, receivedAt, {
            status: ParseStatus.ERROR,
            reason: err.message,
          });
        }
      }

      const summary = `${syncedCount} baru (+${syncedIncomeCount} income) · ${messageIds.length} discan · dup=${skippedDuplicate} skip=${skippedUnparsed} excl=${skippedExcluded}`;
      await this.prisma.emailSyncLog.create({
        data: { lastSyncAt: new Date(), status: 'SUCCESS', message: summary },
      });

      if (!quiet && syncedCount > 0 && newestTransaction) {
        await this.checkAndAlertIfOverBudget(newestTransaction);
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
        data: { lastSyncAt: new Date(), status: 'ERROR', message: err.message },
      });
      return { synced: 0, scanned: 0, error: err.message, query };
    }
  }

  private async processMessage(
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
    const rawEmail = this.extractRawEmail(message);
    if (!rawEmail) {
      callbacks.onUnparsed();
      await this.logParseResult(id, from, subject, receivedAt, {
        status: ParseStatus.UNPARSED,
        reason: 'body kosong / tidak bisa didekode',
      });
      return;
    }

    const { parser, result: parsed } = this.parserRegistry.parseEmailWithSource(rawEmail);
    if (!parsed) {
      callbacks.onUnparsed();
      await this.logParseResult(id, from, subject, receivedAt, {
        status: ParseStatus.UNPARSED,
        reason: 'no parser matched / parser return null',
        parser,
      });
      return;
    }

    if (parsed.kind === 'INCOME') {
      await this.processIncome(id, rawEmail.id, from, subject, receivedAt, parsed, notifyEveryTransaction, parser, callbacks);
      return;
    }

    if (parsed.excluded) {
      this.logger.debug(`Skip (excluded): ${parsed.excludeReason}`);
      callbacks.onExcluded();
      if (parsed.balanceOnly) {
        await this.applyBalanceOnlyDebit(id, parsed);
      }
      await this.logParseResult(id, from, subject, receivedAt, {
        status: ParseStatus.EXCLUDED,
        reason: parsed.excludeReason,
        amount: parsed.amount,
        parser,
      });
      return;
    }

    const category = await this.resolveCategory(parsed.description, parsed.amount, parsed.categoryHint);

    const created = await this.transactionService.createFromParsed({
      amount: parsed.amount,
      description: parsed.description,
      source: parsed.source,
      emailId: rawEmail.id,
      occurredAt: parsed.occurredAt,
      category,
    });

    if (created) {
      callbacks.onRecorded({ source: parsed.source, description: parsed.description, amount: parsed.amount });

      await this.logParseResult(id, from, subject, receivedAt, {
        status: ParseStatus.RECORDED,
        amount: parsed.amount,
        counterparty: parsed.description,
        kind: 'EXPENSE',
        parser,
      });

      if (notifyEveryTransaction) {
        await this.telegramService.sendTransactionNotif({
          source: parsed.source,
          description: parsed.description,
          amount: parsed.amount,
          occurredAt: parsed.occurredAt,
        });
      }
    } else {
      callbacks.onDuplicate();
      await this.logParseResult(id, from, subject, receivedAt, {
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
    const created = await this.incomeService.createFromParsed({
      amount: parsed.amount,
      description: parsed.description,
      source: parsed.source,
      occurredAt: parsed.occurredAt,
      emailId,
    });

    if (!created) {
      callbacks.onDuplicate();
      await this.logParseResult(id, from, subject, receivedAt, {
        status: ParseStatus.DUPLICATE,
        amount: parsed.amount,
        kind: 'INCOME',
        parser,
      });
      return;
    }

    callbacks.onIncomeRecorded();
    await this.logParseResult(id, from, subject, receivedAt, {
      status: ParseStatus.RECORDED,
      amount: parsed.amount,
      counterparty: parsed.description,
      kind: 'INCOME',
      parser,
    });

    if (notifyEveryTransaction) {
      await this.telegramService.sendIncomeNotif({
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
  private async applyBalanceOnlyDebit(emailId: string, parsed: ParseResult) {
    const existing = await this.prisma.emailParseLog.findUnique({ where: { emailId } });
    if (existing?.status === ParseStatus.EXCLUDED) return;

    await this.prisma.$transaction(async (tx) => {
      const lastAdjustmentAt = await this.balanceService.getLastManualAdjustmentAt(tx, parsed.source);
      if (shouldAdjustBalance(parsed.occurredAt, lastAdjustmentAt)) {
        await this.balanceService.adjustBalance(tx, parsed.source, -parsed.amount);
      }
    });
  }

  /** Pipeline kategorisasi (E00-S3): rule merchant (by merchantKey) → heuristik parser
   * (`categoryHint`) → AI fast, lalu hasil AI disimpan sebagai rule baru biar merchant yang sama
   * ke depannya konsisten tanpa panggil AI lagi. */
  private async resolveCategory(
    description: string,
    amount: number,
    categoryHint?: Category,
  ): Promise<Category> {
    const rule = await this.merchantAliasService.findCategoryForDescription(description);
    if (rule) return rule;

    if (categoryHint) return categoryHint;

    const aiResult = (await this.aiChatService.categorize(description, amount)) as Category;
    if (aiResult !== Category.LAINNYA) {
      await this.merchantAliasService.upsertCategory(description, aiResult);
    }
    return aiResult;
  }

  private async checkAndAlertIfOverBudget(lastTransaction: {
    source: string;
    description: string;
    amount: number;
  }) {
    const summary = await this.budgetService.getTodaySummary();
    if (!summary.isOverBudget) return;

    const todayDateOnly = new Date(summary.date);
    const alreadyAlerted = await this.prisma.alertLog.findUnique({ where: { date: todayDateOnly } });
    if (alreadyAlerted) return;

    const sent = await this.telegramService.sendBudgetAlert({
      totalSpent: summary.totalSpent,
      budget: summary.budget,
      lastTransaction,
    });

    if (sent) {
      await this.prisma.alertLog.create({ data: { date: todayDateOnly } });
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
    const existing = await this.prisma.emailParseLog.findUnique({ where: { emailId } });
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
    await this.prisma.emailParseLog.upsert({
      where: { emailId },
      create: { emailId, ...data },
      update: data,
    });
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