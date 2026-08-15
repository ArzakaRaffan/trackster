import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { GmailAuthService } from './gmail-auth.service';
import { ParserRegistryService } from './parsers/parser-registry.service';
import { RawEmail } from './parsers/parser.interface';
import { TransactionService } from '../transaction/transaction.service';
import { BudgetService } from '../budget/budget.service';
import { TelegramService } from '../telegram/telegram.service';
import { PrismaService } from '../../prisma.service';

// TODO: konfirmasi & lengkapi query sender begitu domain email asli BCA/Jago diketahui dari header.
// Sementara pakai keyword umum yang sudah terbukti match nama tampilan sender.
const GMAIL_QUERY = 'from:(bca OR jago) newer_than:7d';

// Nama job di SchedulerRegistry — dibutuhkan biar next-run bisa di-query dari luar (lihat getNextRun()).
const SYNC_CRON_JOB_NAME = 'gmail-sync';

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
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: SYNC_CRON_JOB_NAME })
  async handleCron() {
    await this.syncEmails();
  }

  /** Kapan sync otomatis berikutnya bakal jalan, buat ditampilin sebagai countdown di frontend. */
  getNextRun(): string {
    const job = this.schedulerRegistry.getCronJob(SYNC_CRON_JOB_NAME);
    const next = job.nextDate();
    return next.toJSDate().toISOString();
  }

  async syncEmails() {
    const gmail = await this.gmailAuthService.getGmailClient();
    if (!gmail) {
      this.logger.debug('Gmail belum terhubung, skip sync.');
      return { synced: 0 };
    }

    try {
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: GMAIL_QUERY,
        maxResults: 20,
      });

      const messages = listRes.data.messages || [];
      let syncedCount = 0;
      let newestTransaction: { source: string; description: string; amount: number } | null = null;
      const notifyEveryTransaction = await this.telegramService.isNotifyEveryTransactionEnabled();

      for (const msg of messages) {
        if (!msg.id) continue;

        const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
        const rawEmail = this.extractRawEmail(full.data);
        if (!rawEmail) continue;

        const parsed = this.parserRegistry.parseEmail(rawEmail);
        if (!parsed) continue; // bukan notifikasi transaksi yang dikenali, atau bukan dari BCA/Jago

        if (parsed.excluded) {
          this.logger.debug(`Skip (excluded): ${parsed.excludeReason}`);
          continue;
        }

        const created = await this.transactionService.createFromParsed({
          amount: parsed.amount,
          description: parsed.description,
          source: parsed.source,
          emailId: rawEmail.id,
          occurredAt: parsed.occurredAt,
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
        }
      }

      await this.prisma.emailSyncLog.create({
        data: { lastSyncAt: new Date(), status: 'SUCCESS', message: `${syncedCount} transaksi baru` },
      });

      if (syncedCount > 0 && newestTransaction) {
        await this.checkAndAlertIfOverBudget(newestTransaction);
      }

      return { synced: syncedCount };
    } catch (err) {
      this.logger.error(`Gmail sync gagal: ${err.message}`);
      await this.prisma.emailSyncLog.create({
        data: { lastSyncAt: new Date(), status: 'ERROR', message: err.message },
      });
      return { synced: 0, error: err.message };
    }
  }

  /** Kirim alert Telegram maksimal 1x per hari (dicek via AlertLog) begitu budget hari ini terlampaui. */
  private async checkAndAlertIfOverBudget(lastTransaction: { source: string; description: string; amount: number }) {
    const summary = await this.budgetService.getTodaySummary();
    if (!summary.isOverBudget) return;

    const todayDateOnly = new Date(summary.date);
    const alreadyAlerted = await this.prisma.alertLog.findUnique({ where: { date: todayDateOnly } });
    if (alreadyAlerted) return; // sudah kirim alert hari ini, jangan spam

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

  /** Gmail body bisa nested multipart, cari bagian text/plain (fallback text/html kalau tidak ada) */
  private extractBody(payload: any): string | null {
    const plainRaw = this.findPartByMimeType(payload, 'text/plain');
    if (plainRaw) return this.decodeBase64(plainRaw);

    const htmlRaw = this.findPartByMimeType(payload, 'text/html');
    if (htmlRaw) return this.htmlToText(this.decodeBase64(htmlRaw));

    return null;
  }

  /** Cari rekursif bagian pertama yang match mimeType tertentu, return raw base64 body data-nya (belum di-decode) */
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

  /**
   * Konversi HTML jadi teks per-baris supaya extractField (yang berbasis split '\n') tetap bekerja.
   * Ganti tag block-level jadi newline dulu SEBELUM strip tag sisanya, biar tidak jadi satu baris raksasa.
   */
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
