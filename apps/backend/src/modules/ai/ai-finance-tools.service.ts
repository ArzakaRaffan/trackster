import { Injectable } from '@nestjs/common';
import { BudgetService } from '../budget/budget.service';
import { TransactionService } from '../transaction/transaction.service';
import { IncomeService } from '../income/income.service';
import { AiTool } from './ai.service';

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
        description: 'Ambil ringkasan keuangan hari ini: budget, total pengeluaran, transaksi hari ini',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => this.budgetService.getTodaySummary(),
      },
      {
        name: 'getWeeklySummary',
        description: 'Ambil ringkasan pengeluaran minggu ini per hari',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => this.transactionService.getWeekly(),
      },
      {
        name: 'getInsights',
        description: 'Ambil insight pengeluaran: top merchant, kategori terbesar, budget adherence. range:  30d (default) atau all',
        input_schema: {
          type: 'object',
          properties: {
            range: {
              type: 'string',
              enum: ['30d', 'all'],
              description: 'Rentang data: 30 hari terakhir (30d) atau semua data (all)',
            },
          },
          required: [],
        },
        handler: async (input: { range?: '30d' | 'all' }) =>
          this.transactionService.getInsights(input.range ?? '30d'),
      },
      {
        name: 'getMonthlySummary',
        description: 'Ambil ringkasan pengeluaran bulan tertentu',
        input_schema: {
          type: 'object',
          properties: {
            year: { type: 'number', description: 'Tahun, contoh: 2026' },
            month: { type: 'number', description: 'Bulan 1-12' },
          },
          required: ['year', 'month'],
        },
        handler: async (input: { year: number; month: number }) =>
          this.transactionService.getMonthly(input.year, input.month),
      },
      {
        name: 'getAllTimeSummary',
        description: 'Ambil ringkasan pengeluaran sepanjang masa: total, rata-rata, dll',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => this.transactionService.getAllTimeSummary(),
      },
    ];
  }
}
