import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { GmailAuthService } from './gmail-auth.service';
import { ParserRegistryService } from './parsers/parser-registry.service';
import { RawEmail } from './parsers/parser.interface';
import { TransactionService } from '../transaction/transaction.service';
import { BudgetService } from '../budget/budget.service';
import { TelegramService } from '../telegram/telegram.service';
import { PrismaService } from '../../prisma.service';
import { AiChatService } from '../ai/ai-chat.service';
import { Category } from '@prisma/client';

// Cron window tetap pendek biar ringan. Historical gap pakai syncEmails({ after, before }).
const GMAIL_QUERY_RECENT = 'from:(bca OR jago) newer_than:7d';

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
      const parts = ['from:(bca OR jago)'];
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
      let skippedExcluded = 0;
      let skippedUnparsed = 0;
      let skippedDuplicate = 0;
      let newestTransaction: { source: string; description: string; amount: number } | null = null;
      const notifyEveryTransaction =
        !quiet && (await this.telegramService.isNotifyEveryTransactionEnabled());

      for (const id of messageIds) {
        const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
        const rawEmail = this.extractRawEmail(full.data);
        if (!rawEmail) {
          skippedUnparsed++;
          continue;
        }

        const parsed = this.parserRegistry.parseEmail(rawEmail);
        if (!parsed) {
          skippedUnparsed++;
          continue;
        }

        if (parsed.excluded) {
          this.logger.debug(`Skip (excluded): ${parsed.excludeReason}`);
          skippedExcluded++;
          continue;
        }

        const categoryStr = await this.aiChatService.categorize(parsed.description, parsed.amount);
        const category = categoryStr as Category;

        const created = await this.transactionService.createFromParsed({
          amount: parsed.amount,
          description: parsed.description,
          source: parsed.source,
          emailId: rawEmail.id,
          occurredAt: parsed.occurredAt,
          category,
        });

        if (created) {
          syncedCount++;
          newestTransaction = {
            source: parsed.source,
            description: parsed.description,
            amount: parsed.amount,
          };

          if (notifyEveryTransaction) {
            await this.telegramService.sendTransactionNotif({
              source: parsed.source,
              description: parsed.description,
              amount: parsed.amount,
              occurredAt: parsed.occurredAt,
            });
          }
        } else {
          skippedDuplicate++;
        }
      }

      const summary = `${syncedCount} baru · ${messageIds.length} discan · dup=${skippedDuplicate} skip=${skippedUnparsed} excl=${skippedExcluded}`;
      await this.prisma.emailSyncLog.create({
        data: { lastSyncAt: new Date(), status: 'SUCCESS', message: summary },
      });

      if (!quiet && syncedCount > 0 && newestTransaction) {
        await this.checkAndAlertIfOverBudget(newestTransaction);
      }

      return {
        synced: syncedCount,
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
    return html
      .replace(/<\/(td|tr|p|div|br|table|li)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/[ \t]+/g, ' ')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n');
  }
}