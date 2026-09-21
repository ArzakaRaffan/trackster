import { Injectable } from '@nestjs/common';
import { BudgetService } from '../budget/budget.service';
import { TransactionService } from '../transaction/transaction.service';
import { IncomeService } from '../income/income.service';
import { AiTool } from './ai.service';
import { Source, Category } from '@prisma/client';

@Injectable()
export class AiFinanceToolsService {
  constructor(
    private budgetService: BudgetService,
    private transactionService: TransactionService,
    private incomeService: IncomeService,
  ) {}

  getTools(): AiTool[] {
    return [
      {
        name: 'getTodaySummary',
        description: 'Ambil ringkasan keuangan hari ini: budget harian, total pengeluaran, sisa budget, dan daftar transaksi hari ini',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => this.budgetService.getTodaySummary(),
      },
      {
        name: 'getWeeklySummary',
        description: 'Ambil ringkasan pengeluaran minggu ini per hari beserta total',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => this.transactionService.getWeekly(),
      },
      {
        name: 'getInsights',
        description: 'Ambil insight pengeluaran: top merchant, kategori terbesar, budget adherence, trend. range: "30d" (default, 30 hari terakhir) atau "all" (semua data)',
        input_schema: {
          type: 'object',
          properties: {
            range: {
              type: 'string',
              enum: ['30d', 'all'],
              description: 'Rentang data: 30 hari terakhir atau semua data',
            },
          },
          required: [],
        },
        handler: async (input: { range?: '30d' | 'all' }) =>
          this.transactionService.getInsights(input?.range ?? '30d'),
      },
      {
        name: 'getMonthlySummary',
        description: 'Ambil ringkasan pengeluaran bulan tertentu: total, per kategori, per sumber',
        input_schema: {
          type: 'object',
          properties: {
            year: { type: 'number', description: 'Tahun, contoh: 2026' },
            month: { type: 'number', description: 'Bulan 1-12, contoh: 9 untuk September' },
          },
          required: ['year', 'month'],
        },
        handler: async (input: { year: number; month: number }) =>
          this.transactionService.getMonthly(input.year, input.month),
      },
      {
        name: 'getAllTimeSummary',
        description: 'Ambil ringkasan pengeluaran sepanjang masa: total keseluruhan, rata-rata bulanan, dll',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => this.transactionService.getAllTimeSummary(),
      },
      {
        name: 'getIncomeAllocation',
        description: 'Ambil rekomendasi alokasi mingguan: berapa yang sebaiknya ditabung, diinvestasikan, dan boleh dihabiskan bebas, dihitung dari rata-rata pemasukan mingguan dikurangi target budget mingguan.',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => this.incomeService.getAllocationRecommendation(),
      },
      {
        name: 'logExpense',
        description: 'Catat pengeluaran manual (tunai atau non-email) yang disebutkan user di chat. Gunakan tool ini kalau user bilang sudah beli/bayar/ngeluarin sesuatu.',
        input_schema: {
          type: 'object',
          properties: {
            amount: {
              type: 'number',
              description: 'Jumlah pengeluaran dalam Rupiah, contoh: 25000',
            },
            description: {
              type: 'string',
              description: 'Deskripsi pengeluaran, contoh: "Kopi Kenangan"',
            },
            category: {
              type: 'string',
              enum: ['MAKANAN', 'TRANSPORT', 'BELANJA', 'TAGIHAN', 'HIBURAN', 'KESEHATAN', 'LAINNYA'],
              description: 'Kategori pengeluaran',
            },
            source: {
              type: 'string',
              enum: ['BCA', 'JAGO'],
              description: 'Sumber rekening: BCA atau JAGO. Default BCA kalau tidak disebutkan.',
            },
          },
          required: ['amount', 'description', 'category', 'source'],
        },
        handler: async (input: {
          amount: number;
          description: string;
          category: string;
          source: string;
        }) =>
          this.transactionService.create({
            amount: input.amount,
            description: input.description,
            category: input.category as Category,
            source: (input.source || 'BCA') as Source,
            occurredAt: new Date().toISOString(),
          }),
      },
    ];
  }
}
