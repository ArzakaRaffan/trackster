import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { TransactionService } from '../transaction/transaction.service';
import { IncomeService } from '../income/income.service';
import { MerchantAliasService } from '../merchant-alias/merchant-alias.service';
import { BudgetService } from '../budget/budget.service';
import { TelegramService } from '../telegram/telegram.service';
import { AiChatService } from '../ai/ai-chat.service';
import { AiCaptionService } from '../ai/ai-caption.service';
import { AiAnomalyService } from '../ai/ai-anomaly.service';
import { IngestIncomeDto, IngestTransactionDto } from './dto/ingest.dto';
import { resolveEventTime } from './ingest.util';

const AI_TIMEOUT_MS = 6_000; // Shortcut menunggu balasan: jangan biarkan kategorisasi AI menahan terlalu lama
const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

/** Pintu masuk (B) di 02-Target-Architecture §6: userId SELALU dari ApiToken (guard), kunci idempotensi → `ing:<key>`. */
@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private prisma: PrismaService,
    private transactionService: TransactionService,
    private incomeService: IncomeService,
    private merchantAliasService: MerchantAliasService,
    private budgetService: BudgetService,
    private telegramService: TelegramService,
    private aiChatService: AiChatService,
    private aiCaptionService: AiCaptionService,
    private aiAnomalyService: AiAnomalyService,
  ) {}

  async ingestTransaction(userId: number, key: string, dto: IngestTransactionDto) {
    const occurredAt = resolveEventTime(dto.occurredAt);
    if (!occurredAt) throw new BadRequestException('occurredAt tidak valid (format ISO 8601, tidak boleh di masa depan)');
    const emailId = `ing:${key}`;

    const existing = await this.prisma.transaction.findFirst({ where: { userId, emailId } });
    if (existing) return this.duplicateTx(existing);

    const category = dto.category ?? (await this.resolveCategory(userId, dto.description, dto.amount));
    let created;
    try {
      created = await this.transactionService.createFromParsed(userId, {
        amount: dto.amount,
        description: dto.description,
        source: dto.source,
        emailId,
        occurredAt,
        category,
      });
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
      created = null; // kalah balapan dgn request berkunci sama
    }
    if (!created) {
      const dup = await this.prisma.transaction.findFirst({ where: { userId, emailId } });
      if (dup) return this.duplicateTx(dup);
      throw new BadRequestException('Gagal mencatat transaksi');
    }

    // Kosmetik/proaktif: tak boleh menggagalkan pencatatan.
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

    const summary = await this.budgetService.getTodaySummary(userId);
    // ponytail: salinan kecil dari GmailSyncService.checkAndAlertIfOverBudget — Gmail dihapus di Fase 7, jangan abstraksikan dulu.
    this.alertIfOverBudget(userId, summary, { source: created.source, description: created.description, amount: Number(created.amount) }).catch((e) =>
      this.logger.warn(`Alert over-budget gagal: ${e?.message}`),
    );

    const sisa = summary.remaining >= 0 ? `sisa budget hari ini ${rupiah(summary.remaining)}` : `budget hari ini terlampaui ${rupiah(-summary.remaining)}`;
    return {
      success: true,
      duplicate: false,
      id: created.id,
      category: created.category,
      message: `Tercatat ${rupiah(Number(created.amount))} (${created.description}) — ${sisa}`,
    };
  }

  async ingestIncome(userId: number, key: string, dto: IngestIncomeDto) {
    const receivedAt = resolveEventTime(dto.receivedAt);
    if (!receivedAt) throw new BadRequestException('receivedAt tidak valid (format ISO 8601, tidak boleh di masa depan)');

    if (dto.streamId) {
      const own = await this.prisma.incomeStream.findFirst({ where: { id: dto.streamId, userId }, select: { id: true } });
      if (!own) throw new BadRequestException('streamId tidak ditemukan');
    }

    const res = await this.incomeService.createQuick(
      userId,
      { amount: dto.amount, description: dto.description, streamName: dto.streamName, source: dto.source },
      { externalId: `ing:${key}`, receivedAt, streamId: dto.streamId },
    );
    return { success: true, duplicate: res.duplicate, id: res.income.id, message: res.message };
  }

  private duplicateTx(t: { id: number; category: Category; amount: unknown }) {
    return { success: true, duplicate: true, id: t.id, category: t.category, message: 'Transaksi ini sudah tercatat sebelumnya' };
  }

  /** Aturan merchant user → AI (dibatasi waktu, hasil dipelajari sbg aturan) → LAINNYA. */
  private async resolveCategory(userId: number, description: string, amount: number): Promise<Category> {
    const rule = await this.merchantAliasService.findCategoryForDescription(userId, description);
    if (rule) return rule;
    try {
      const ai = (await Promise.race([
        this.aiChatService.categorize(description, amount),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), AI_TIMEOUT_MS)),
      ])) as Category;
      if (ai && ai !== Category.LAINNYA) await this.merchantAliasService.upsertCategory(userId, description, ai);
      return ai ?? Category.LAINNYA;
    } catch {
      return Category.LAINNYA;
    }
  }

  private async alertIfOverBudget(
    userId: number,
    summary: { date: string; isOverBudget: boolean; totalSpent: number; budget: number },
    lastTransaction: { source: string; description: string; amount: number },
  ) {
    if (!summary.isOverBudget) return;
    const date = new Date(summary.date);
    if (await this.prisma.alertLog.findFirst({ where: { userId, date } })) return;
    const sent = await this.telegramService.sendBudgetAlert(userId, { totalSpent: summary.totalSpent, budget: summary.budget, lastTransaction });
    if (sent) await this.prisma.alertLog.create({ data: { userId, date } });
  }
}
