import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { GmailAuthService } from './gmail-auth.service';
import { EmailPipelineService } from './email-pipeline.service';
import { RawEmail, htmlToText } from './parsers/parser.interface';
import { TelegramService } from '../telegram/telegram.service';
import { PrismaService } from '../../prisma.service';
import { ParseStatus } from '@prisma/client';

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
  // Sync per user tak boleh tumpang tindih (cron 5 menit vs tombol sync/backfill, atau run lama yang lewat 5 menit):
  // dua proses email yang sama bisa sama-sama mendebit saldo transfer-ke-rekening-sendiri. ponytail: in-memory, 1 instance backend.
  private readonly running = new Set<number>();

  constructor(
    private gmailAuthService: GmailAuthService,
    private pipeline: EmailPipelineService,
    private telegramService: TelegramService,
    private prisma: PrismaService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: SYNC_CRON_JOB_NAME })
  async handleCron() {
    // Satu mailbox per user yang punya token (saat ini hanya pemilik). Gagal di satu user tak menghentikan yang lain.
    const tokens = await this.prisma.gmailToken.findMany({ select: { userId: true } });
    for (const { userId } of tokens) {
      try {
        await this.syncEmails(userId);
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
    if (this.running.has(userId)) return { synced: 0, scanned: 0, query: 'Sync sebelumnya masih berjalan' };
    this.running.add(userId);
    try {
      return await this.syncEmailsUnlocked(userId, options);
    } finally {
      this.running.delete(userId);
    }
  }

  private async syncEmailsUnlocked(userId: number, options?: SyncOptions) {
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

      // Email yang sudah RECORDED langsung dilewati pipeline — jangan unduh isinya lagi tiap 5 menit (dulu: semua email 7 hari).
      const recorded = new Set(
        (
          await this.prisma.emailParseLog.findMany({
            where: { userId, emailId: { in: messageIds }, status: ParseStatus.RECORDED },
            select: { emailId: true },
          })
        ).map((l) => l.emailId),
      );

      for (const id of messageIds) {
        if (recorded.has(id)) {
          skippedDuplicate++;
          continue;
        }
        const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
        const { from, subject, receivedAt } = this.extractHeaders(full.data);

        try {
          await this.pipeline.process(userId, id, this.extractRawEmail(full.data), { from, subject, receivedAt }, notifyEveryTransaction, {
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
          await this.pipeline.logParseResult(userId, id, { from, subject, receivedAt }, {
            status: ParseStatus.ERROR,
            reason: err.message,
          });
        }
      }

      const summary = `${syncedCount} baru (+${syncedIncomeCount} income) · ${messageIds.length} discan · dup=${skippedDuplicate} skip=${skippedUnparsed} excl=${skippedExcluded}`;
      await this.prisma.emailSyncLog.create({
        data: { userId, lastSyncAt: new Date(), status: 'SUCCESS', message: summary },
      });
      // Satu baris tiap 5 menit (±100rb/tahun/user) padahal UI hanya membaca 20 terakhir.
      await this.prisma.emailSyncLog.deleteMany({ where: { userId, createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } });

      if (!quiet && syncedCount > 0 && newestTransaction) {
        await this.pipeline.checkAndAlertIfOverBudget(userId, newestTransaction);
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

  private extractHeaders(message: any): { from: string; subject: string; receivedAt: Date } {
    const headers = message?.payload?.headers || [];
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const internalDate = message?.internalDate ? Number(message.internalDate) : Date.now();
    return { from, subject, receivedAt: new Date(internalDate) };
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


