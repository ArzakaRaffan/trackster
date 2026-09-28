# Trackster — Codemap (mau ubah X, buka di mana)

Snapshot 2026-09-24. Kalau nambah module/route/cron, update file ini.

## Backend — `apps/backend/src/modules/`

| Module | Route prefix | Isi penting |
| --- | --- | --- |
| auth | `/auth` | login/logout/me, cookie `trackster_jwt`. Guard: `common/guards/jwt-auth.guard.ts`, dipasang per controller (nggak ada global guard). |
| gmail | `/gmail` | OAuth (scope gmail.readonly + calendar.events), `gmail-sync.service.ts` cron 5 menit, query `from:(bca OR jago OR flip)`. |
| gmail/parsers | — | `parser-registry` urutan **Flip → BCA → Jago**. Helper: `parser.interface.ts` (`extractField`, `parseEmailDate` WIB, `parseRupiah`), `own-accounts.ts` (deteksi rekening sendiri, termasuk nomor ter-mask). |
| sync | `/sync` | trigger manual, backfill rentang tanggal (default tanpa notif Telegram), next-run, logs. |
| transaction | `/transactions` | list+filter, weekly/monthly/summary/day/insights, create manual, note/category/alias. `createFromParsed()` = jalur sync. `getInsights()` = sumber data semua fitur analitik/AI. |
| balance | `/balance` | saldo per source, koreksi manual, histori adjustment. `adjustBalance(tx, source, delta)` wajib di dalam `$transaction`. |
| budget | `/budget` | budget per hari, `today` summary, `runway`. |
| income | `/income` | CRUD + `allowance-suggestion` + `allocation`. |
| merchant-alias | `/merchant-aliases` | CRUD alias. |
| goal | `/goal` | Kantong: create, contribute, archive, simulate (what-if). |
| subscription | `/subscriptions` | CRUD + sync event Google Calendar (`googleCalendarEventId`). |
| telegram | `/telegram` | config/test (JWT) + `POST /telegram/webhook/:secret` (public; cek secret + chatId). |
| ai | `/ai` | `chat`, `mascot-tip`, health-score history, trigger manual laporan. |
| split-bill | `/split-bills` | privat (JWT) + `public`, `manage/:ownerToken`, `public/:slug`. Scan struk: `split-bill-ai.service.ts`. |

### AI internals (`modules/ai/`)
- `ai.service.ts` — client OpenAI-compat/Anthropic-style + `runToolLoop()`. Env: `AI_BASE_URL`,
  `AI_API_KEY`, `AI_AUTH_HEADER` (default `x-bf-vk`), `AI_MODEL`; fallback ke `SPLITBILL_AI_*`.
- `ai-finance-tools.service.ts` — tools: getTodaySummary, getWeeklySummary, getInsights,
  getMonthlySummary, getAllTimeSummary, getIncomeAllocation, logExpense. Tool baru = reuse service
  yang ada, jangan query Prisma manual.
- `ai-chat.service.ts` — chat handler + `categorize()` (dipanggil dari sync).
- `ai-reports.service.ts` — cron weekly & monthly + `computeAndSaveHealthScore()`.
- `ai-mascot.service.ts` — tip mascot.

### Cron (semua `@nestjs/schedule`)
| Jadwal | Job |
| --- | --- |
| tiap 5 menit | Gmail sync → parse → kategori AI → simpan + adjust saldo → cek budget → alert |
| Minggu 20:00 WIB | Weekly insight ke Telegram + simpan Health Score |
| tiap hari 20:00 WIB (eksekusi cuma di hari terakhir bulan) | Monthly report card ke Telegram |

## Frontend — `apps/frontend/src/`

| Route | Isi |
| --- | --- |
| `/` | Landing page publik |
| `/login` | Login |
| `/app` | Dashboard (net +/-, shortcut) |
| `/app/today`, `/app/weekly` | Harian & mingguan vs budget |
| `/app/reports`, `/app/insights` | Laporan bulanan/all-time, analisis + health score |
| `/app/income`, `/app/budget`, `/app/goals`, `/app/subscriptions` | Pemasukan+alokasi, budget, Kantong, langganan |
| `/app/chat` | Tanya Track |
| `/app/more`, `/app/settings` | Menu lain; Gmail/Telegram/akun/saldo |
| `/split-bills/*`, `/s/[slug]`, `/savings-calculator` | Tools publik |

- Data: `lib/api.ts` (fetcher, auto-redirect `/login` on 401) + SWR. Format: `lib/format.ts`. Motion: `lib/motion.ts`.
- UI reusable: `components/ui/*` (Input, Button, AmountDisplay, StatTile, BudgetProgress,
  TransactionNoteRow, AnimatedTabContent, SourceTag, Switch, DayBarChart). `MascotWidget` di-mount di `app/app/layout.tsx`.
- Auth redirect: `middleware.ts`.

## Dokumen lain di repo
- `TRACKSTER_BUILD_PLAN.md` — plan MVP awal + **contoh format email asli** BCA/Jago (rujukan parser).
- `TRACKSTER_AI_FEATURES_PLAN.md` — konvensi AI (tool-calling, cron, reuse helper). Status: selesai.
- `design_system/` — token, guideline, `handoff/README.md`.

## Drift yang ketemu (belum dibenerin)
- `CLAUDE.md` nyebut folder `design-system/`, aslinya `design_system/`.
- `.env.example`: komentar URL prod masih domain lama (`trackster.my.id`, `api.trackster.my.id`);
  belum ada `AI_*`, `AI_AUTH_HEADER`, `TELEGRAM_WEBHOOK_SECRET`, `COOKIE_DOMAIN`.
- `Source.GOPAY` masih di enum & tipe frontend walau nggak ada sumber aktif.
