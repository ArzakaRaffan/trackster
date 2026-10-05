import { Injectable } from '@nestjs/common';
import { BudgetService } from '../budget/budget.service';
import { TransactionService } from '../transaction/transaction.service';
import { IncomeService } from '../income/income.service';
import { GoalService } from '../goal/goal.service';
import { IncomeForecastService } from '../income-forecast/income-forecast.service';
import { PlanSimulatorService } from './plan-simulator.service';
import { AiTool } from './ai.service';
import { AiCaptionService } from './ai-caption.service';
import { AiMemoryService } from './ai-memory.service';
import { RetrievalService } from './retrieval.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { BudgetAdvisorService } from '../budget/budget-advisor.service';
import { Source, Category, MemoryKind } from '@prisma/client';
import { addWibDays, startOfWibDay, wibDateKey } from '../../common/wib';

/** Kartu yang ikut disimpan di ChatMessage.attachments pesan assistant terakhir (lihat
 * AiChatService.sendMessage) — cuma metadata rendering, bukan sumber angka baru buat model. */
export interface ToolCard {
  card: Record<string, unknown>;
}

@Injectable()
export class AiFinanceToolsService {
  constructor(
    private budgetService: BudgetService,
    private transactionService: TransactionService,
    private incomeService: IncomeService,
    private goalService: GoalService,
    private incomeForecastService: IncomeForecastService,
    private planSimulatorService: PlanSimulatorService,
    private aiCaptionService: AiCaptionService,
    private aiMemoryService: AiMemoryService,
    private retrievalService: RetrievalService,
    private analyticsService: AnalyticsService,
    private budgetAdvisorService: BudgetAdvisorService,
  ) {}

  /** `ctx.userId` = pemilik percakapan, DIIKAT SERVER saat tool dibuat — tidak pernah datang dari argumen
   *  tool yang diisi model (prompt-injection tidak bisa berpindah user).
   *  `threadId`/`excludeAfterId` = thread & window pesan yang sedang dikirim ulang ke model, dipakai
   *  `searchPastConversations` biar nggak nyaranin balik pesan yang sudah ada di history. */
  getTools(ctx: { userId: number; threadId?: number; excludeAfterId?: number }): AiTool[] {
    const { userId } = ctx;
    return [
      {
        name: 'getTodaySummary',
        description: 'Ambil ringkasan keuangan hari ini: budget harian, total pengeluaran, sisa budget, dan daftar transaksi hari ini',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => this.budgetService.getTodaySummary(userId),
      },
      {
        name: 'getWeeklySummary',
        description: 'Ambil ringkasan pengeluaran minggu ini per hari beserta total',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => this.transactionService.getWeekly(userId),
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
          this.transactionService.getInsights(userId, input?.range ?? '30d'),
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
          this.transactionService.getMonthly(userId, input.year, input.month),
      },
      {
        name: 'getAllTimeSummary',
        description: 'Ambil ringkasan pengeluaran sepanjang masa: total keseluruhan, rata-rata bulanan, dll',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => this.transactionService.getAllTimeSummary(userId),
      },
      {
        name: 'getIncomeAllocation',
        description: 'Ambil rekomendasi alokasi mingguan: berapa yang sebaiknya ditabung, diinvestasikan, dan boleh dihabiskan bebas, dihitung dari rata-rata pemasukan mingguan dikurangi target budget mingguan.',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => this.incomeService.getAllocationRecommendation(userId),
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
        }) => {
          const created = await this.transactionService.create(userId, {
            amount: input.amount,
            description: input.description,
            category: input.category as Category,
            source: (input.source || 'BCA') as Source,
            occurredAt: new Date().toISOString(),
          });
          this.aiCaptionService
            .generate(userId, {
              id: created.id,
              description: created.description,
              amount: Number(created.amount),
              category: created.category,
              occurredAt: created.occurredAt,
            })
            .catch(() => {});
          return created;
        },
      },
      {
        name: 'searchTransactions',
        description: 'Cari transaksi berdasarkan kata kunci deskripsi/catatan, kategori, rentang tanggal, dan/atau nominal minimum. Pakai ini kalau user nanya soal transaksi spesifik (mis. "kapan terakhir aku beli di Indomaret?").',
        input_schema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Kata kunci pencarian di deskripsi/catatan/alias merchant' },
            category: {
              type: 'string',
              enum: ['MAKANAN', 'TRANSPORT', 'BELANJA', 'TAGIHAN', 'HIBURAN', 'KESEHATAN', 'LAINNYA', 'TRANSFER', 'TOPUP', 'PENDIDIKAN', 'PERAWATAN', 'INVESTASI', 'ROKOK'],
            },
            from: { type: 'string', description: 'Tanggal mulai, format YYYY-MM-DD' },
            to: { type: 'string', description: 'Tanggal akhir (inklusif), format YYYY-MM-DD' },
            minAmount: { type: 'number', description: 'Nominal minimum dalam Rupiah' },
            limit: { type: 'number', description: 'Maks hasil, default 20, maks 50' },
          },
          required: [],
        },
        handler: async (input: { text?: string; category?: string; from?: string; to?: string; minAmount?: number; limit?: number }) =>
          this.transactionService.findAll(userId, {
            search: input.text,
            category: input.category as Category | undefined,
            startDate: input.from,
            endDate: input.to,
            minAmount: input.minAmount,
            limit: Math.min(50, input.limit ?? 20),
          }),
      },
      {
        name: 'getPeriodStats',
        description: 'Statistik pengeluaran satu periode: "week" (minggu berjalan per hari), "month" (butuh date "YYYY-MM", default bulan berjalan), atau "range" (butuh from & to "YYYY-MM-DD").',
        input_schema: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['week', 'month', 'range'] },
            date: { type: 'string', description: 'Untuk period="month": "YYYY-MM"' },
            from: { type: 'string', description: 'Untuk period="range": tanggal mulai "YYYY-MM-DD"' },
            to: { type: 'string', description: 'Untuk period="range": tanggal akhir "YYYY-MM-DD"' },
          },
          required: ['period'],
        },
        handler: async (input: { period: 'week' | 'month' | 'range'; date?: string; from?: string; to?: string }) => {
          if (input.period === 'week') return this.transactionService.getWeekly(userId);
          if (input.period === 'range') {
            if (!input.from || !input.to) return { error: 'period="range" butuh from & to' };
            const start = startOfWibDay(input.from);
            const end = addWibDays(startOfWibDay(input.to), 1);
            return this.analyticsService.getPeriodStats(userId, start, end);
          }
          const now = new Date();
          const [y, m] = (input.date ?? wibDateKey(now).slice(0, 7)).split('-').map(Number);
          return this.transactionService.getMonthly(userId, y, m);
        },
      },
      {
        name: 'getIncomeForecast',
        description: 'Forecast pemasukan mingguan (konservatif/ekspektasi/maks) untuk beberapa minggu ke depan, per stream pemasukan.',
        input_schema: {
          type: 'object',
          properties: {
            weeks: { type: 'number', description: 'Jumlah minggu ke depan, default 4, maks 26' },
          },
          required: [],
        },
        handler: async (input: { weeks?: number }) => this.incomeForecastService.getHorizon(userId, Math.min(26, input.weeks ?? 4)),
      },
      {
        name: 'getGoals',
        description: 'Ambil daftar goal tabungan aktif beserta progres saat ini dan kontribusi mingguan yang dibutuhkan untuk mengejar deadline (kalau ada deadline).',
        input_schema: { type: 'object', properties: {}, required: [] },
        handler: async () => {
          const goals = await this.goalService.findAll(userId);
          const today = new Date();
          return goals.map((g) => {
            const remaining = Math.max(0, Number(g.targetAmount) - g.currentAmount);
            let weeklyContributionNeeded: number | null = null;
            if (g.targetDate) {
              const weeksLeft = Math.max(1, Math.ceil((g.targetDate.getTime() - today.getTime()) / (7 * 86_400_000)));
              weeklyContributionNeeded = Math.round(remaining / weeksLeft);
            }
            return { ...g, remaining, weeklyContributionNeeded };
          });
        },
      },
      {
        name: 'simulatePlan',
        description: 'Simulasikan rencana keuangan ke depan (pemasukan skenario, perubahan pengeluaran per kategori, pembelian sekali-jalan, target nabung mingguan) dan lihat proyeksi saldo/goal minggu demi minggu. Hasilnya ditampilkan sebagai kartu grafik ke user — jelaskan angka pentingnya di jawabanmu, jangan cuma bilang "sudah kubuatkan".',
        input_schema: {
          type: 'object',
          properties: {
            weeks: { type: 'number', description: 'Horizon simulasi dalam minggu, maks 104' },
            incomeScenario: { type: 'string', enum: ['conservative', 'expected', 'max'] },
            extraIncomePerWeek: { type: 'number' },
            spendChanges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string', description: 'Kategori spesifik, kosongkan untuk total' },
                  pct: { type: 'number', description: 'mis. -20 = kurangi 20%' },
                  weeklyAmount: { type: 'number', description: 'Delta nominal tetap per minggu' },
                },
              },
            },
            oneOffs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  week: { type: 'number' },
                  amount: { type: 'number' },
                  label: { type: 'string' },
                },
                required: ['week', 'amount', 'label'],
              },
            },
            savePerWeek: { type: 'number', description: 'Target nabung tetap per minggu' },
            goal: {
              type: 'object',
              properties: { target: { type: 'number' }, current: { type: 'number' } },
            },
          },
          required: ['weeks', 'incomeScenario'],
        },
        handler: async (input: any) => {
          const result = await this.planSimulatorService.simulatePlan(userId, input);
          return {
            ...result,
            card: { type: 'simulation', title: `Simulasi ${input.weeks} minggu`, ...result },
          };
        },
      },
      {
        name: 'whatIfPurchase',
        description: 'Bandingkan dampak SATU pembelian (tunai atau cicilan) terhadap goal tabungan — dipakai untuk pertanyaan "kalau aku beli X, goal aku mundur berapa lama?".',
        input_schema: {
          type: 'object',
          properties: {
            amount: { type: 'number' },
            label: { type: 'string' },
            method: { type: 'string', enum: ['cash', 'installment'] },
            months: { type: 'number', description: 'Untuk method=installment' },
            monthlyRate: { type: 'number', description: 'Bunga per bulan dalam persen, default 0' },
            weeks: { type: 'number', description: 'Horizon simulasi, default 26' },
            incomeScenario: { type: 'string', enum: ['conservative', 'expected', 'max'] },
            savePerWeek: { type: 'number' },
            goal: {
              type: 'object',
              properties: { target: { type: 'number' }, current: { type: 'number' } },
            },
          },
          required: ['amount', 'label', 'method'],
        },
        handler: async (input: any) => {
          const result = await this.planSimulatorService.whatIfPurchase(userId, input);
          return {
            ...result,
            card: {
              type: 'simulation',
              title: `Simulasi: ${input.label}`,
              series: result.with.series,
              compareSeries: result.without.series,
              summary: result.with.summary,
              assumptions: result.with.assumptions,
              extra: { weeksDelay: result.weeksDelay, totalCost: result.totalCost },
            },
          };
        },
      },
      {
        name: 'proposeGoal',
        description: 'Usulkan goal tabungan baru ke user — TIDAK langsung membuat goal, cuma menampilkan kartu dengan tombol "Buat goal" yang harus dikonfirmasi user sendiri.',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            target: { type: 'number' },
            deadline: { type: 'string', description: 'Format YYYY-MM-DD, opsional' },
            weeklyContribution: { type: 'number', description: 'Saran nabung per minggu, opsional' },
          },
          required: ['name', 'target'],
        },
        handler: async (input: { name: string; target: number; deadline?: string; weeklyContribution?: number }): Promise<ToolCard> => ({
          card: { type: 'goal-proposal', ...input },
        }),
      },
      {
        name: 'proposeBudget',
        description: 'Usulkan budget harian minggu ini ke user berdasarkan konteks yang tidak ada di data (mis. "ada acara ultah Sabtu, geser jatah ke Sabtu"). TIDAK langsung mengubah budget — cuma menampilkan kartu dengan tombol "Terapkan" yang harus dikonfirmasi user sendiri. Angkanya dihitung ulang oleh engine (bukan kamu yang mengarang), total mingguan opsi tetap sama.',
        input_schema: {
          type: 'object',
          properties: {
            option: { type: 'string', enum: ['hemat', 'seimbang', 'longgar'], description: 'Default: opsi yang direkomendasikan sistem minggu ini' },
            dayOverrides: {
              type: 'array',
              description: 'Hari yang jatahnya mau digeser, sisa hari lain otomatis menyesuaikan',
              items: {
                type: 'object',
                properties: {
                  dayOfWeek: { type: 'number', description: '0=Minggu..6=Sabtu' },
                  amount: { type: 'number' },
                },
                required: ['dayOfWeek', 'amount'],
              },
            },
            note: { type: 'string', description: 'Alasan singkat penyesuaian, ditampilkan di kartu' },
          },
          required: [],
        },
        handler: async (input: { option?: string; dayOverrides?: { dayOfWeek: number; amount: number }[]; note?: string }): Promise<ToolCard> => {
          const option = (input.option as any) ?? 'seimbang';
          const result = await this.budgetAdvisorService.proposeAdjusted(userId, undefined, option, input.dayOverrides ?? []);
          return { card: { type: 'budget-proposal', ...result, note: input.note ?? null } };
        },
      },
      {
        name: 'logIncome',
        description: 'Catat pemasukan manual yang disebutkan user di chat (mis. "barusan dapat honor 200rb"). Untuk pemasukan rutin terjadwal (les/magang/mingguan), arahkan user ke halaman check-in mingguan, bukan tool ini.',
        input_schema: {
          type: 'object',
          properties: {
            amount: { type: 'number' },
            description: { type: 'string' },
            source: { type: 'string', enum: ['BCA', 'JAGO'] },
          },
          required: ['amount', 'description', 'source'],
        },
        handler: async (input: { amount: number; description: string; source: string }) =>
          this.incomeService.create(userId, {
            amount: input.amount,
            description: input.description,
            source: input.source as Source,
            receivedAt: new Date().toISOString(),
          }),
      },
      {
        name: 'remember',
        description: 'Simpan fakta tahan lama tentang Arzaka yang dia minta diingat secara eksplisit (mis. "ingat ya, aku...") — bukan buat angka yang sudah ada di database.',
        input_schema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Fakta, ditulis orang ketiga, contoh: "Arzaka ingin beli laptop ±Rp12jt sebelum Juni 2027"' },
            kind: {
              type: 'string',
              enum: ['PROFILE', 'GOAL', 'PLAN', 'PREFERENCE', 'CONCERN', 'EVENT', 'DECISION'],
              description: 'Jenis fakta',
            },
          },
          required: ['content', 'kind'],
        },
        handler: async (input: { content: string; kind: string }) =>
          this.aiMemoryService.create(userId, { content: input.content, kind: input.kind as MemoryKind }),
      },
      {
        name: 'forget',
        description: 'Hapus (arsip) satu memory yang sudah tidak relevan — dipakai kalau Arzaka bilang "lupain yang itu" atau semacamnya.',
        input_schema: {
          type: 'object',
          properties: {
            memoryId: { type: 'number', description: 'id memory yang mau dilupakan' },
          },
          required: ['memoryId'],
        },
        handler: async (input: { memoryId: number }) => this.aiMemoryService.update(userId, input.memoryId, { archived: true }),
      },
      {
        name: 'searchPastConversations',
        description: 'Cari percakapan atau laporan lama yang mungkin relevan dengan pertanyaan Arzaka sekarang (mis. "dulu aku pernah nanya soal apa ya?"). Bukan buat data finansial presisi — pakai tool lain untuk itu.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Kata kunci pencarian, contoh: "laptop" atau "nabung"' },
          },
          required: ['query'],
        },
        handler: async (input: { query: string }) =>
          this.retrievalService.search(userId, input.query, {
            excludeThreadId: ctx.threadId,
            excludeAfterId: ctx.excludeAfterId,
          }),
      },
    ];
  }
}
