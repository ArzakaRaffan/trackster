# Trackster — AI Financial Buddy Rework: Implementation Plan

Status: **SELESAI.** Semua 13 fitur (Phase 0-6) sudah diimplementasi dan di-deploy — lihat git log
`feat(ai): Phase 0` s/d `feat(ai): Complete Phases 0-6` (2026-09-21) + fix `AI chat 500`. Plan di
bawah ini sekarang jadi referensi arsitektur, bukan todo list — kalau mau nambah fitur AI baru,
baca konvensi Phase 0 (AiService, AiTool, tool-calling loop) di sini dulu sebelum bikin pola baru.

Tambahan di luar 13 fitur awal (juga sudah selesai, 2026-09-21): mascot floating widget
(`apps/frontend/src/components/MascotWidget.tsx`, di-mount lewat `apps/frontend/src/app/app/layout.tsx`)
dan income allocator (`IncomeService.getAllocationRecommendation()` + `GET /income/allocation` +
tool `getIncomeAllocation` + card di `/app/income`).

Baca [CLAUDE.md](CLAUDE.md) dulu sebelum mulai — semua gotcha infra (Prisma+Alpine, urutan
NODE_ENV, cookie cross-subdomain, dst) berlaku penuh ke kode baru di plan ini, tidak diulang di
sini.

## Fitur yang di-acc (13 fitur, semua tema di-acc kecuali Calendar Sync)

Tema 1 — AI Consultation & Chat: Tanya Trackster, Weekly AI Insight Report, Financial Health
Score, Pre-purchase Advisor.
Tema 2 — Smart Budgeting & Behavior: Kantong (goal envelope), Runway Forecast, Opportunity-cost
Nudge, Income-smoothing Allowance.
Tema 3 — Automation & Integrasi: Subscription Detector, Quick Entry via Chat, LLM
Auto-categorization. (Calendar Sync ditolak user, skip.)
Tema 4 — Reporting & Planning: What-if Goal Simulator, Monthly Report Card.

## State codebase saat ini (dicek langsung dari kode, bukan asumsi — 2026-09-21)

**LLM foundation sudah ada, tinggal digeneralisasi.**
`apps/backend/src/modules/split-bill/split-bill-ai.service.ts` sudah manggil Claude via mwapi.dev
(`POST {SPLITBILL_AI_BASE_URL}/v1/messages`, header `x-api-key` + `anthropic-version: 2023-06-01`,
model `claude-sonnet-5`). Single-shot text/JSON only — **belum ada tool-calling** (`tools`/
`tool_use` belum pernah dipakai di codebase ini).

**Auth pattern:** tidak ada global guard. Tiap controller pasang `@UseGuards(JwtAuthGuard)`
sendiri (`apps/backend/src/common/guards/jwt-auth.guard.ts` — baca cookie `trackster_jwt`, verify
JWT, set `request.user`). Endpoint yang sengaja public (mis. `split-bills/public/:slug`) cukup
tidak pasang decorator itu. Ikuti pola ini persis, jangan bikin guard baru kecuali benar-benar
perlu (Telegram webhook di Phase 0 adalah satu-satunya kasus yang butuh proteksi bukan-JWT).

**Query helper yang WAJIB direuse, jangan query Prisma manual dari modul baru:**
- `budget.service.ts`: `getBudgetForDay(dayOfWeek)`, `getTodaySummary()` — budget, totalSpent,
  remaining, isOverBudget, totalIncome, netAmount, transactions, incomes hari ini.
- `transaction.service.ts`: `getWeekly()`, `getByDay(date)`, `getMonthly(year, month)`,
  `getAllTimeSummary()`, `getInsights(range)` — **`getInsights()` sudah menghitung trend
  minggu-ke-minggu, top 5 merchant, category breakdown, spend-by-day-of-week, dan budget
  adherence 30 hari.** Ini sumber data utama buat Weekly Insight Report, Financial Health Score,
  DAN Opportunity-cost Nudge (topMerchants) — jangan bikin query agregat baru buat tiga fitur ini,
  reuse `getInsights()` yang sudah ada.
- `income.service.ts`: baru CRUD (`findAll`, `create`, `update`, `remove`), belum ada aggregate —
  Income-smoothing Allowance akan jadi fungsi aggregate pertama di sini.
- `balanceService.adjustBalance(tx, source, delta)` — WAJIB dipanggil di dalam `prisma.$transaction`
  yang sama dengan operasi pemicunya (lihat `transaction.service.ts` `create()`/`createFromParsed()`
  buat contoh persis). Setiap kode baru yang bikin `Transaction`/`Income` baru HARUS lewat pola ini,
  jangan insert langsung tanpa balance adjustment.

**Gap nyata yang plan ini isi:** `Transaction.category` di `createFromParsed()`
(`transaction.service.ts` baris ~385-402, path email-sync) **tidak pernah di-set** — selalu jatuh
ke default Prisma `LAINNYA`. Tidak ada keyword-matching atau auto-categorization apapun di
codebase. `updateCategory(id, category)` sudah ada buat koreksi manual (dipanggil dari
`TransactionNoteRow` component di frontend).

**Telegram sekarang cuma outbound.** `telegram.service.ts` cuma punya `sendMessage`, `sendTest`,
`sendBudgetAlert`, `sendTransactionNotif`, semua bikin `new TelegramBot(token, {polling:false})`
ad-hoc per call lalu `bot.sendMessage()`. Tidak ada webhook, tidak ada `bot.on('message')`, tidak
ada handler inbound sama sekali. `TelegramConfig` cuma punya 1 row (single user) — `botToken`,
`chatId`, `isActive`, `notifyEveryTransaction`.

**Cron pattern:** `gmail-sync.service.ts` pakai `@Cron(CronExpression.EVERY_5_MINUTES, { name: ... })`
dari `@nestjs/schedule` (sudah terdaftar via `ScheduleModule.forRoot()` di `app.module.ts`). Ikuti
pola persis ini buat cron job baru (weekly/monthly report).

**Frontend yang SUDAH ADA dan harus di-reuse, bukan dibikin ulang:**
- `apps/frontend/src/app/app/insights/page.tsx` — sudah render penuh `getInsights()` (trend card,
  budget adherence, category pie, day-of-week bar, top merchant list). Financial Health Score
  tinggal nambah 1 card baru di halaman ini, bukan halaman baru.
- `apps/frontend/src/app/app/reports/page.tsx` — sudah render `getMonthly()` + `getAllTimeSummary()`
  (tab Bulanan/All Time, chart, transaction list+search). Monthly Report Card = narasi AI yang
  di-generate dari data yang SAMA dengan yang sudah ditampilkan di sini, dikirim Telegram oleh cron
  — halaman ini tidak perlu diubah kecuali mau menambah card "Ringkasan AI" opsional.
- `apps/frontend/src/app/savings-calculator/SavingsCalculator.tsx` — kalkulator target tabungan
  yang SUDAH ADA, tapi murni one-shot (tidak nge-track progress beneran) — ada teks
  "Segera hadir: fitur Target Tabungan otomatis..." (baris 233-236) yang literally menunggu fitur
  Kantong ini. Phase 4 Kantong sebaiknya jadi halaman baru `/app/goals`, dan
  `SavingsCalculator.tsx` bisa di-link ke sana / CTA-nya diupdate — TIDAK perlu ganti kalkulatornya
  sendiri, itu tetap berguna sebagai standalone tool.
- Komponen reusable: `@/components/ui/{Input,Button,AmountDisplay,StatTile,BudgetProgress,
  TransactionNoteRow,AnimatedTabContent}`, `@/lib/api` (fetcher `api.get/post/put/patch/delete`,
  auto-redirect ke `/login` on 401), `@/lib/format` (`formatRupiah`, `MONTH_NAMES`), `@/lib/motion`
  (`TRANSITION_BASE`/`TRANSITION_SLOW`). Semua halaman baru WAJIB pakai token Tailwind custom yang
  sudah ada (`text-ink-muted`, `bg-surface`, `rounded-comfortable`, dst) — lihat halaman existing
  buat referensi persis, jangan pakai warna/spacing baru.

**DTO convention:** `class-validator` decorators di tiap `dto/*.ts` (`@IsNumber() @Min(0)`,
`@IsEnum(...)`, `@IsISO8601()`, `@IsString() @MinLength(1)`), divalidasi otomatis lewat
`ValidationPipe({ whitelist: true, transform: true })` global di `main.ts`. Ikuti persis pola
`create-transaction.dto.ts`.

**Migration:** `prisma migrate dev --name <deskripsi>` lokal, format folder existing:
`<timestamp>_<snake_case_description>` (contoh: `20260819061156_add_manual_transaction_flag`).
Commit folder migration-nya, JANGAN cuma edit `schema.prisma`.

---

## Phase 0 — AI Foundation

**Kenapa duluan:** 8 dari 13 fitur (semua Tema 1, Quick Entry, Auto-categorization,
Opportunity-cost Nudge) butuh ini.

### 0.1 Generalisasi AI client

Buat modul baru `apps/backend/src/modules/ai/`:
- `ai.module.ts` — exports `AiService`, providers `[AiService, PrismaService]`.
- `ai.service.ts` — generalisasi dari `split-bill-ai.service.ts`:
  - Baca config: `process.env.AI_API_KEY ?? process.env.SPLITBILL_AI_API_KEY`,
    `process.env.AI_BASE_URL ?? process.env.SPLITBILL_AI_BASE_URL ?? 'https://api.mwapi.dev'`,
    `process.env.AI_MODEL ?? process.env.SPLITBILL_AI_MODEL ?? 'claude-sonnet-5'`. **Fallback ke
    env SPLITBILL_AI_* biar tidak breaking** — tidak perlu migrasi env paksa di VPS.
  - Method `chat(params: { system: string; messages: AnthropicMessage[]; tools?: AiTool[];
    maxTokens?: number }): Promise<AnthropicResponse>` — POST langsung ke `/v1/messages` persis
    pola `split-bill-ai.service.ts` (fetch + error handling `InternalServerErrorException` on
    `!res.ok`), TAPI kirim `tools` field kalau ada, dan **return response mentah** (bukan
    langsung parse text) — biar caller yang decide loop tool-calling atau tidak.
  - Method `runToolLoop(params: { system: string; userMessage: string; tools: AiTool[];
    maxIterations?: number }): Promise<string>` — loop: kirim messages, kalau
    `response.stop_reason === 'tool_use'`, jalankan tiap block `type: 'tool_use'` lewat
    `tool.handler(block.input)`, append hasil sebagai `role: 'user'` content
    `{type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result)}`, lanjut loop.
    Berhenti di `stop_reason !== 'tool_use'` atau `maxIterations` (default 5, cegah infinite loop
    kalau model nyangkut manggil tool terus) — return text block terakhir.
  - Type `AiTool = { name: string; description: string; input_schema: object; handler: (input: any)
    => Promise<unknown> }` — didefinisikan di file terpisah per konsumen (lihat 0.2), bukan di
    `ai.service.ts` (service ini generic, tidak tahu domain finance).

**Kenapa satu modul `ai` isinya banyak service, bukan 1 modul per fitur:** semua fitur AI di plan
ini share satu LLM client + satu pola tool-calling. Pisah jadi 5 modul NestJS kecil buat 5 fitur
yang sebenarnya satu concern (manggil LLM) cuma nambah boilerplate wiring tanpa manfaat — beda
dari `Goal`/`Transaction`/`Budget` yang memang domain terpisah. Modul `ai` akan diisi bertahap:
`ai.service.ts` (Phase 0), `ai-chat.service.ts` (Phase 1-2), `ai-reports.service.ts` (Phase 3).

`split-bill-ai.service.ts` **TIDAK perlu direfactor ke `AiService`** di Phase 0 — biarkan jalan
seperti sekarang, cukup pastikan env fallback di atas tidak menabrak `SPLITBILL_AI_*` yang dia
pakai. Konsolidasi itu nice-to-have, bukan prasyarat fitur manapun di plan ini.

### 0.2 Financial data tools

File baru `apps/backend/src/modules/ai/ai-finance-tools.service.ts` — `@Injectable()` yang
inject `BudgetService`, `TransactionService`, `IncomeService`, expose method
`getTools(): AiTool[]` yang wrap:
- `getTodaySummary` → `budgetService.getTodaySummary()`
- `getWeeklySummary` → `transactionService.getWeekly()`
- `getInsights` → `transactionService.getInsights(input.range ?? '30d')`
- `getMonthlySummary` → `transactionService.getMonthly(input.year, input.month)`
- `getAllTimeSummary` → `transactionService.getAllTimeSummary()`

Tiap tool `input_schema` pakai JSON Schema minimal (cuma param yang benar-benar dipakai, mis.
`getMonthlySummary` butuh `{year: number, month: number}`, yang lain `{}` atau `{range?: string}`).
Tools baru dari Phase 2/4 (`logExpense`, goal-related) ditambahkan ke array yang sama, jangan bikin
file tools kedua.

### 0.3 Telegram inbound

Prasyarat Quick Entry via Chat & chat lewat Telegram (Phase 1-2).

- `telegram.controller.ts`: tambah endpoint public **tanpa** `@UseGuards(JwtAuthGuard)` (endpoint
  ini di luar `@UseGuards` di level controller yang sudah ada — kalau perlu, split jadi controller
  baru `telegram-webhook.controller.ts` tanpa guard class-level, biar tidak numpuk decorator
  per-method):
  `POST telegram/webhook/:secret` — validasi `secret === process.env.TELEGRAM_WEBHOOK_SECRET`
  (403 kalau tidak match), lalu:
  1. Ambil `TelegramConfig` (single row, `prisma.telegramConfig.findFirst()`).
  2. **WAJIB cek** `req.body.message.chat.id.toString() === config.chatId` — endpoint ini public
     di internet, siapapun yang tahu URL bisa POST; tanpa cek ini orang lain bisa "ngobrol" pakai
     bot kamu dan baca data finansial kamu lewat tool-calling. Kalau tidak match, return 200 tanpa
     proses (jangan kasih clue ke caller kalau ditolak).
  3. Extract `req.body.message.text` (kalau kosong/bukan text message, no-op, return 200).
  4. Panggil `AiChatService.handleMessage(text, { channel: 'telegram' })` (Phase 1), lalu
     `telegramService.sendMessage(replyText)`.
- Env baru: `TELEGRAM_WEBHOOK_SECRET=` (random string, generate sendiri, taruh di `.env.example`
  dengan komentar cara generate `openssl rand -hex 24`).
- **Setup manual (bukan kode, dokumentasikan sebagai langkah deploy):** setelah deploy, hit sekali
  `https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://api.track.trackster.my.id/telegram/webhook/<TELEGRAM_WEBHOOK_SECRET>`
  biar Telegram mulai kirim update ke endpoint ini. Verifikasi dengan
  `https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo`.

### Acceptance Phase 0
`npm run build` (backend) lolos. `POST /telegram/webhook/<secret salah>` return 403. Kirim pesan
manual ke bot Telegram → webhook nerima payload (cek log), balikin chat.id mismatch check jalan
(test dari akun Telegram lain, tidak diproses).

---

## Phase 1 — Tanya Trackster + Pre-purchase Advisor

Satu chat engine dipakai dua cara. **Bukan dua fitur terpisah secara teknis** — Pre-purchase
Advisor tidak dapat file/modul sendiri.

### Backend
`apps/backend/src/modules/ai/ai-chat.service.ts`:
- `handleMessage(text: string, ctx: { channel: 'web' | 'telegram' }): Promise<string>` — panggil
  `aiService.runToolLoop({ system: FINANCIAL_ADVISOR_SYSTEM_PROMPT, userMessage: text, tools:
  aiFinanceToolsService.getTools() })`.
- System prompt (const di file yang sama, bahasa Indonesia, persona "financial advisor personal
  buat Arzaka") — WAJIB eksplisit larang ngarang angka: "SELALU panggil tool buat data finansial
  apapun, JANGAN pernah menjawab dari asumsi." (mirror gotcha `PLANNER_API_KEY` di
  `ai-trackster/CLAUDE.md` soal model yang bisa "ngarang" — cegah dari system prompt, bukan
  post-hoc validation, karena ini teks bebas bukan JSON terstruktur).

`ai.module.ts` update: tambah `AiChatService`, `AiFinanceToolsService` ke providers, import
`BudgetModule`/`TransactionModule`/`IncomeModule` (untuk inject service-nya — cek exports di
masing-masing `*.module.ts`, tambahkan export kalau belum di-export).

Controller baru `ai.controller.ts`:
```
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  @Post('chat')
  async chat(@Body() dto: ChatMessageDto) {
    return { reply: await this.aiChatService.handleMessage(dto.message, { channel: 'web' }) };
  }
}
```
`dto/chat-message.dto.ts`: `{ @IsString() @MinLength(1) message: string }`.

Wire `telegram-webhook.controller.ts` (Phase 0.3) untuk manggil `AiChatService.handleMessage`
yang sama.

**Scope cut yang disengaja:** tidak ada tabel `ChatMessage`/persistensi riwayat chat di v1. Tiap
pesan diproses stateless (tapi tool-augmented — LLM tetap "tahu" kondisi keuangan real-time lewat
tools, cuma tidak ingat kalimat sebelumnya). Frontend web boleh simpan riwayat percakapan di React
state (hilang kalau refresh) buat UX chat yang wajar dalam 1 sesi. *Upgrade path kalau kerasa
kurang: tambah model `ChatMessage {id, channel, role, content, createdAt}`, kirim N pesan
terakhir sebagai context di `messages` array ke `aiService.chat()`.*

### Frontend
Halaman baru `apps/frontend/src/app/app/chat/page.tsx` — pola sama seperti `today/page.tsx`
(sticky header, `pb-navbar animate-fade-in-up`), chat bubble list (state React lokal, bukan SWR
karena ini bukan data yang di-refetch), input di bawah pakai `@/components/ui/Input`, submit ke
`api.post('/ai/chat', { message })`. Tambah entry navigasi di bottom nav (cek komponen navbar,
kemungkinan `apps/frontend/src/components/ui/` atau `app/app/layout.tsx` — cari file yang render
nav existing, ikuti pola icon `lucide-react` yang sudah dipakai halaman lain, mis. `MessageCircle`).

### Acceptance Phase 1
Login ke web app, buka `/app/chat`, tanya "berapa sisa budget hari ini?" → jawaban sesuai angka
asli di `/app/today`. Tanya "boleh gak beli barang 300rb sekarang?" → jawaban reference ke sisa
budget/pola pengeluaran nyata, bukan generic advice. Kirim pesan sama dari Telegram (setelah
webhook Phase 0 aktif) → dapat balasan di chat Telegram.

---

## Phase 2 — LLM Auto-categorization + Quick Entry via Chat

### Auto-categorization
`transaction.service.ts`, method `createFromParsed()` (baris ~385): sebelum `tx.transaction.create`,
panggil kategorisasi. Tambah method baru di file yang sama (atau `ai-chat.service.ts` kalau mau
pisah concern AI keluar dari `transaction.service.ts` — **pilih yang kedua**, biar
`transaction.service.ts` tidak depend ke `ai` module dan sebaliknya modul `ai` yang depend ke
`TransactionModule` sesuai arah dependency Phase 0/1):

`ai-chat.service.ts` tambah method:
```
async categorize(description: string, amount: number): Promise<Category> {
  // single-shot call (bukan tool loop), prompt suruh jawab PERSIS salah satu value enum Category
  // (list eksplisit di prompt: MAKANAN, TRANSPORT, BELANJA, TAGIHAN, HIBURAN, KESEHATAN, LAINNYA).
  // Validasi response ada di Object.values(Category) — kalau tidak match, fallback LAINNYA + log
  // warning (JANGAN throw, kategorisasi gagal bukan alasan gagalkan pencatatan transaksi).
}
```

`gmail-sync.service.ts` (caller `createFromParsed`): setelah dapat `ParsedTransaction`, panggil
`aiChatService.categorize(parsed.description, parsed.amount)` sebelum `transactionService
.createFromParsed()`, sisipkan hasilnya ke `ParsedTransaction` (tambah field `category?: Category`
ke interface `ParsedTransaction` di `transaction.service.ts`, dipakai di `createFromParsed`'s
`data.category`). Circular dependency check: `GmailModule` sudah/belum import `AiModule`? — pasang
di `gmail.module.ts`.

**Manual `create()` TIDAK diubah** — form manual sudah minta category eksplisit dari user
(`CreateTransactionDto.category` required), itu tetap dihormati, auto-categorization cuma buat
jalur email-parse yang sekarang selalu `LAINNYA`.

### Quick Entry via Chat
Tambah tool baru ke `AiFinanceToolsService.getTools()`:
```
{
  name: 'logExpense',
  description: 'Catat pengeluaran manual (tunai/non-email) yang disebutkan user di chat',
  input_schema: { amount: number, description: string, category: enum Category, source: 'BCA'|'JAGO' },
  handler: (input) => transactionService.create({ ...input, occurredAt: new Date().toISOString() }),
}
```
Reuse `transactionService.create()` yang sudah ada (`isManual: true`, sudah handle balance
adjustment via `$transaction`) — **tidak ada logic baru di transaction module**, tool ini murni
adapter. System prompt Phase 1 perlu ditambah instruksi: "kalau user bilang habis beli/bayar
sesuatu (bukan nanya), pakai tool `logExpense`, lalu konfirmasi ke user apa yang barusan dicatat."

### Acceptance Phase 2
Trigger `sync/trigger` manual dengan email fixture baru → transaksi baru punya `category` bukan
`LAINNYA` (cek DB/`/app/reports`). Di chat Telegram/web, ketik "beli kopi 25rb tadi" → muncul
transaksi baru di `/app/today` dengan amount 25000, source default masuk akal, category masuk akal.

---

## Phase 3 — Weekly Insight, Financial Health Score, Monthly Report Card

`apps/backend/src/modules/ai/ai-reports.service.ts` — inject `TransactionService`, `AiService`,
`TelegramService`, `PrismaService`.

### Weekly Insight Report
```
@Cron(CronExpression.EVERY_WEEK, { name: 'weekly-insight-report' }) // atau cron string eksplisit
                                                                      // Minggu 20:00 WIB — cek
                                                                      // timezone handling di
                                                                      // ScheduleModule (gmail-sync
                                                                      // tidak butuh timezone spesifik,
                                                                      // job baru ini perlu, cek opsi
                                                                      // `timeZone: 'Asia/Jakarta'`
                                                                      // di decorator @Cron)
async sendWeeklyInsight() {
  const insights = await this.transactionService.getInsights('30d');
  const narrative = await this.aiService.chat({ system: WEEKLY_NARRATIVE_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(insights) }] });
  await this.telegramService.sendMessage(extractText(narrative));
}
```
Prompt minta: 1 paragraf pola pengeluaran + maks 3 rekomendasi konkret + **1 kalimat
opportunity-cost dari `insights.topMerchants[0]`** (ini yang mewujudkan fitur Opportunity-cost
Nudge — reuse data yang sama, tidak query baru, lihat catatan di bagian "State codebase" di atas).

### Financial Health Score
Model baru di `schema.prisma`:
```prisma
model HealthScoreLog {
  id                    Int      @id @default(autoincrement())
  weekStart             DateTime @db.Date @unique
  score                 Int      // 0-100, dihitung algoritmik (bukan dari LLM)
  budgetAdherencePct    Decimal  @db.Decimal(5, 2)
  savingsRatePct        Decimal  @db.Decimal(5, 2)
  aiCommentary          String?  // 1 kalimat dari LLM, opsional kalau call gagal skor tetap tersimpan
  createdAt             DateTime @default(now())
}
```
Method `computeHealthScore()` di `ai-reports.service.ts` (dipanggil dari cron mingguan yang sama
di atas, sekali jalan bareng):
- `budgetAdherencePct` dari `insights.budgetAdherence.percentageOverBudget` (sudah ada, tinggal
  invert: `100 - percentageOverBudget`).
- `savingsRatePct`: **belum ada helper ini** — hitung manual: total `Income` dalam 30 hari terakhir
  vs total `Transaction` (amount) dalam 30 hari terakhir, `(totalIncome - totalSpent) /
  totalIncome * 100`, clamp 0-100 kalau negatif jadi 0. Query langsung di method ini (bukan tambah
  ke `income.service.ts` karena ini spesifik hitungan skor, bukan reusable helper umum — beda
  dengan Income-smoothing Allowance di Phase 4 yang memang perlu jadi helper reusable).
- `score = Math.round(budgetAdherencePct * 0.6 + savingsRatePct * 0.4)` — bobot ini keputusan
  produk sederhana (budget discipline > savings rate karena user income tidak selalu di
  kontrolnya), **tandai sebagai angka yang bisa di-tuning nanti, bukan final**.
- `aiCommentary`: 1 call LLM singkat, prompt kasih angka skornya minta 1 kalimat reaksi manusiawi.
- Simpan `HealthScoreLog` dengan `weekStart` = Senin minggu ini (pola hitung Senin sama seperti
  `getWeekOverWeekTrend()` di `transaction.service.ts`, reuse logic `daysSinceMonday` yang sama).

Endpoint baru `GET ai/health-score/history` (`ai.controller.ts`, `@UseGuards(JwtAuthGuard)`) →
`prisma.healthScoreLog.findMany({ orderBy: { weekStart: 'desc' }, take: 12 })` buat chart tren skor
di frontend.

### Monthly Report Card
```
@Cron('0 20 L * *', { name: 'monthly-report-card', timeZone: 'Asia/Jakarta' }) // tanggal
                                                                                 // terakhir bulan,
                                                                                 // jam 20:00 WIB
async sendMonthlyReportCard() {
  const now = new Date();
  const monthly = await this.transactionService.getMonthly(now.getFullYear(), now.getMonth() + 1);
  const allTime = await this.transactionService.getAllTimeSummary();
  // narasi dari kedua data ini, kirim Telegram — pola sama dengan weekly insight
}
```
**Catatan cron expression:** `L` (last day of month) TIDAK didukung standar cron 5-field yang
dipakai `@nestjs/schedule` (library `cron` — cek support `L` di versi yang terpasang sebelum pakai;
kalau tidak didukung, fallback: jalan tiap hari jam 20:00, cek `now.getDate() === lastDayOfMonth(now)`
di awal method, early-return kalau bukan tanggal itu — lebih verbose tapi portable).

### Frontend
- `/app/insights/page.tsx`: tambah 1 card baru render skor terbaru + sparkline dari
  `GET /ai/health-score/history` (SWR, fetcher pola sama file ini). Taruh di atas `TrendCard`.
- Tidak ada halaman baru buat Weekly Insight/Monthly Report Card — keduanya push-only ke Telegram,
  sesuai keputusan user ("financial buddy" proaktif, bukan yang harus dibuka manual).

### Acceptance Phase 3
Trigger cron manual lewat endpoint test sementara (atau ubah cron expression ke tiap-menit
temporer buat testing, jangan lupa balikin) → pesan Telegram masuk dengan narasi + opportunity-cost
kalimat. `HealthScoreLog` row baru muncul di DB dengan angka masuk akal (adherence match yang di
`/app/insights` sekarang). `/app/insights` render card skor baru tanpa error.

---

## Phase 4 — Kantong (Goals), Runway Forecast, Opportunity-cost Nudge (selesai di Phase 3), Income-smoothing Allowance

*(Opportunity-cost Nudge sudah selesai di Phase 3 lewat weekly cron — tidak ada kerjaan tambahan
di phase ini untuk fitur itu, disebut di judul cuma buat ngikutin daftar tema asli.)*

### Kantong (Goals)
Model baru:
```prisma
model Goal {
  id            Int      @id @default(autoincrement())
  name          String
  targetAmount  Decimal  @db.Decimal(12, 2)
  targetDate    DateTime? @db.Date
  archivedAt    DateTime?
  createdAt     DateTime @default(now())

  contributions GoalContribution[]
}

model GoalContribution {
  id        Int      @id @default(autoincrement())
  goalId    Int
  goal      Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
  amount    Decimal  @db.Decimal(12, 2) // positif = nambah, negatif = tarik (koreksi)
  note      String?
  createdAt DateTime @default(now())

  @@index([goalId])
}
```
`currentAmount` **dihitung dari `SUM(contributions.amount)`, bukan field tersendiri** — konsisten
dengan filosofi "saldo live incremental via delta" yang sudah dipakai `BankBalance` (lihat
`CLAUDE.md` bagian "Domain Logic — Saldo Bank"), tapi di sini cukup agregat on-read (`prisma.
goalContribution.aggregate({ where: { goalId }, _sum: { amount: true } })`) karena Goal tidak
butuh performa baca setinggi BankBalance yang dipakai di tiap request transaksi — **jangan
overengineer jadi field ter-denormalisasi kalau belum kebukti perlu**.

Modul baru `apps/backend/src/modules/goal/` (`goal.module.ts`, `goal.controller.ts`,
`goal.service.ts`, `dto/create-goal.dto.ts`, `dto/contribute-goal.dto.ts`):
- `GET goal` — list goal aktif (`archivedAt: null`) + `currentAmount` teragregasi tiap goal.
- `POST goal` — create.
- `POST goal/:id/contribute` — `{ amount: number, note?: string }`, insert `GoalContribution`.
- `PATCH goal/:id/archive` — set `archivedAt: now()`.

Frontend halaman baru `/app/goals/page.tsx` — card list per goal, progress bar (reuse
`@/components/ui/BudgetProgress` kalau propnya cocok, atau bikin varian — cek komponen itu dulu
sebelum bikin baru), tombol "+" buka form kontribusi (pola modal/sheet sama seperti
`DayDetailSheet` di `reports/page.tsx`). Update CTA di `savings-calculator/SavingsCalculator.tsx`
baris 228-237 dari teks statis "Segera hadir" jadi link ke `/app/goals`.

### Runway Forecast
`budget.service.ts` tambah method:
```
async getRunwayForecast() {
  // burn rate = rata-rata totalSpent 7 hari terakhir (reuse pola query transaction by date range)
  // sisa hari di bulan ini dari now.getDate() ke daysInMonth
  // proyeksi = currentBalance (dari BankBalance, inject BalanceService) - (burnRate * sisaHari)
  // return { burnRatePerDay, projectedEndOfMonthBalance, isProjectedShortfall }
}
```
Endpoint `GET budget/runway` (di `budget.controller.ts`, guard sama). Kalau
`isProjectedShortfall`, sisipkan 1 baris warning di Weekly Insight Report (Phase 3) — reuse
endpoint ini dari `ai-reports.service.ts`, jangan hitung ulang.

Frontend: card baru di `/app/today/page.tsx` (di bawah budget progress existing) atau di
`/app/insights` — pilih `/app/today` karena ini actionable "hari ini" info, bukan analitik
historis.

### Income-smoothing Allowance
`income.service.ts` tambah method:
```
async getSmoothedDailyAllowance(windowDays = 30) {
  // rolling average dari Income.amount dalam windowDays terakhir, dibagi windowDays
  // return { averageDailyIncome, suggestedDailyAllowance } — suggestedDailyAllowance bisa =
  // averageDailyIncome * konstanta tabungan (mis. 0.7) — ini keputusan produk, dokumentasikan
  // asumsinya jelas di komentar kode, jangan angka ajaib tanpa penjelasan
}
```
Endpoint `GET income/allowance-suggestion`. Frontend: tampil **berdampingan** dengan
`DailyBudget` fixed di `/app/budget` page (cari file page budget existing) sebagai info tambahan
("Saran: Rp X/hari berdasarkan income 30 hari terakhir") — **additive, tidak menggantikan** input
budget manual yang sudah ada.

### Acceptance Phase 4
Bikin goal baru, kontribusi 2x, `currentAmount` di response = sum yang benar. `budget/runway`
return angka masuk akal dibanding saldo BCA/Jago asli. `income/allowance-suggestion` berubah
sesuai kalau nambah/hapus income.

---

## Phase 5 — Subscription Detector

`transaction.service.ts` tambah method (bukan modul baru — ini derived view atas `Transaction`
yang sudah ada, sama seperti `getInsights()`/`getAllTimeSummary()`):
```
async getSubscriptions() {
  // 1. Group transaksi 90 hari terakhir by description (reuse pola groupBy yang sudah ada di
  //    getInsights topMerchants)
  // 2. Untuk tiap group dengan >=2 transaksi: cek variance amount (±10%) dan gap antar
  //    occurredAt (28-31 hari) — kalau semua pair berurutan dalam range itu, flag subscription
  // 3. Return [{ description, averageAmount, occurrenceCount, estimatedMonthlyBurn, lastSeenAt }]
}
```
**Tandai sebagai heuristic sederhana** (ponytail: deteksi rule-based dengan window tetap 90 hari
dan toleransi ±10%/28-31 hari — false negative untuk subscription tahunan atau yang baru mulai <2x
kejadian; upgrade path: turunkan ke ML/clustering kalau heuristic ini kebukti sering salah).

Endpoint `GET transactions/subscriptions`. Frontend: card baru di `/app/reports` (tab baru atau
section di `AllTimeTab`) — total `estimatedMonthlyBurn` di-sum, list tiap subscription dengan
`lastSeenAt` biar user bisa lihat mana yang "jarang dipakai".

### Acceptance Phase 5
Buat 2-3 transaksi fixture manual dengan description sama, amount mirip, tanggal berjarak ~30 hari
→ muncul di `transactions/subscriptions`. Transaksi acak/tidak berulang tidak ikut ke-flag.

---

## Phase 6 — What-if Goal Simulator

Bergantung ke `Goal` (Phase 4). Tambah method di `goal.service.ts`:
```
async simulate(goalId: number, params: { cutPercent: number }) {
  // 1. currentAmount dari aggregate contributions (reuse logic yang sama dengan GET goal/:id)
  // 2. historical monthly savings rate: reuse income.service.getSmoothedDailyAllowance() * 30
  //    dikurangi rata-rata monthly spend dari transaction.service.getAllTimeSummary() (atau
  //    getInsights kalau mau window lebih pendek) — REUSE, jangan query ulang dari nol
  // 3. adjustedMonthlySavings = historicalMonthlySavings + (averageMonthlySpend * cutPercent/100)
  // 4. monthsRemaining = (targetAmount - currentAmount) / adjustedMonthlySavings
  // return { currentMonthsRemaining, adjustedMonthsRemaining, monthsSaved }
}
```
Endpoint `POST goal/:id/simulate` — `{ cutPercent: number }` (mis. 20 buat "potong 20%").
**Murni matematika, tidak panggil `AiService` sama sekali** — jangan tambah LLM call yang tidak
perlu di sini, itu melanggar prinsip lazy (angka bisa dihitung deterministik, LLM cuma nambah
latency+cost tanpa manfaat).

Frontend: di halaman `/app/goals/page.tsx` per goal, tambah slider/input "potong pengeluaran %"
yang panggil endpoint ini dan tampilkan "tercapai X bulan lebih cepat".

### Acceptance Phase 6
Goal dengan target jelas, simulasi cutPercent=20 → `adjustedMonthsRemaining <
currentMonthsRemaining`, angka `monthsSaved` masuk akal secara manual dihitung ulang.

---

## Urutan & alasan (recap)

Phase 0-3 duluan karena paling mengubah cara mikir soal duit sehari-hari (chat, kategori otomatis,
insight proaktif) DAN karena Phase 3 (weekly cron) sekaligus menyelesaikan Opportunity-cost Nudge
tanpa kerja tambahan. Phase 4-6 fitur perencanaan (goal, forecast, simulasi) yang nilainya baru
kerasa kalau dasarnya sudah jalan, dan Phase 6 secara teknis butuh Phase 4 selesai duluan.

## Sebelum lapor phase manapun selesai (wajib, dari CLAUDE.md)

`npm run build` (backend) dan `tsc --noEmit` (frontend) HARUS lolos, DAN verifikasi hidup di
browser/Telegram beneran — bukan cuma lolos compile. Migration Prisma di-generate manual
(`prisma migrate dev --name ...`) dan di-commit foldernya, `prisma migrate deploy` di production
tidak akan provision apa-apa kalau folder migration kosong.

## Handoff prompt (siap paste ke agent/session baru)

```
Saya lanjutin rework Trackster (personal finance tracker, NestJS+Prisma+PostgreSQL backend di
apps/backend, Next.js App Router frontend di apps/frontend) jadi "financial buddy" pakai AI.

Baca dulu:
1. CLAUDE.md — konvensi & gotcha project ini, wajib diikuti persis.
2. TRACKSTER_AI_FEATURES_PLAN.md — plan lengkap 7 phase, sudah ada path file, signature fungsi,
   dan kontrak endpoint konkret per phase. Jangan re-explore arsitektur dari nol, plan ini sudah
   hasil riset langsung ke kode.

Mulai dari Phase [ISI NOMOR PHASE] — [ISI NAMA PHASE]. Ikuti file/method/endpoint yang disebutkan
plan persis, reuse service method yang sudah disebutkan (jangan query Prisma manual kalau ada
helper yang sudah ada). Sebelum lapor selesai: build backend+frontend lolos DAN sudah dicoba
hidup (browser untuk web, kirim pesan Telegram beneran untuk fitur chat/webhook).
```
