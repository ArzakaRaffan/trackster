# Trackster — Codemap (mau ubah X, buka di mana)

Snapshot 2026-10-05. Kalau nambah module/route/cron, update file ini.

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

UI = **Trackster v3** (redesign 1:1 dari `docs/Rework Design Trackster/Trackster v3 App.dc.html`). Satu komponen host merender
semua layar; route cuma menentukan layar mana yang aktif.

| Route | Isi |
| --- | --- |
| `/`, `/login`, `/setup` | Landing, masuk/daftar (daftar & wizard = tampilan saja), wizard setup — layar `pre` prototipe |
| `/app`, `/app/today`, `/app/weekly` | Beranda, Hari ini, Mingguan (7 hari terakhir) |
| `/app/budget`, `/app/income`, `/app/income/checkin`, `/app/goals`, `/app/subscriptions` | Rencana |
| `/app/reports`, `/app/insights`, `/app/chat`, `/app/chat/memory`, `/app/categorize` | Insight (insights = Analisis) |
| `/app/more`, `/app/split`, `/app/calc`, `/app/sources`, `/app/privacy`, `/app/settings` | Menu |
| `/demo/*` | Prototipe dengan data contoh (tombol "Coba pakai data contoh" di landing) |
| `(legacy)`: `/split-bills/*`, `/s/[slug]`, `/t/[slug]`, `/trip/*`, `/tools`, `/savings-calculator`, `/installment-calculator` | Tools publik (desain lama, Tailwind) |

Dua root layout: `app/(v3)/layout.tsx` (tanpa `globals.css`/Tailwind preflight — desain v3 bergantung pada default browser) dan
`app/(legacy)/layout.tsx` (Tailwind + Figtree, untuk tools publik).

**Cara kerja v3 (`components/v3/`)**
- `views/*View.tsx`, `V3Tree.tsx`, `pseudo.css` — **digenerate** oleh `scripts/dc-to-tsx.mjs` dari template `.dc.html`. Jangan edit tangan;
  ubah generator atau sumber desain lalu jalankan `node scripts/dc-to-tsx.mjs` (dari `apps/frontend`). Teks contoh yang tertulis di markup
  prototipe diganti kunci view-model `*Txt` lewat tabel `LITERALS` di generator.
- `logic.tsx` — logika prototipe (state, `rv_*`, kamus EN `v3tr()`) dibawa utuh dan **dirawat tangan**; di tempat yang menyentuh data ada cabang
  `this.props.live !== undefined` (mode nyata) vs prototipe (`/demo`).
- `live/useLive.ts` — SWR ke backend → bentuk state prototipe (`flat`, `st`, `chat`, `split`) + `actions` tulis. `live/map.ts`, `live/reports.ts`,
  `live/dates.ts` (tanggal WIB). `V3Host.tsx` — pathname ↔ `page`/`pre` (`lib/v3-routes.ts`), tema/bahasa di localStorage.
- Data: `lib/api.ts` (fetcher, auto-redirect `/login` on 401) + SWR. Auth redirect: `middleware.ts` (`/demo` & `/setup` publik).
- Pemeriksaan fidelitas: bandingkan DOM/geometri dengan `Trackster v3 App (standalone).html` (lihat `docs/Rework Design Trackster/PLAN.md`).

**Logo (SVG)** — `MerchantAlias.icon` + tabel `CategoryIcon` (endpoint di `merchant-aliases`: `PUT /icon`, `GET|PUT /category-icons`).
Nilai = path relatif di `apps/frontend/public/icons/` (mis. `indonesia/bca.svg`). Katalog dibuat `node scripts/build-icons.mjs`
(sumber `<repo>/svg`, skip `undraw_*` & file >100KB) → `src/lib/icon-catalog.ts`; render `src/lib/icons.ts` (`iconCss`), picker `v3/IconPicker.tsx`.
Logo tetap (tak bisa diubah user: BCA/Jago/Flip, Gmail, Calendar, Telegram) = `brandCss()` di `lib/icons.ts`.
Dipakai di baris Hari ini, detail transaksi, Setting → Alias merchant (+ logo kategori). Tambah logo baru = taruh di `svg/`, jalankan skrip.

## Dokumen lain di repo
- `TRACKSTER_BUILD_PLAN.md` — plan MVP awal + **contoh format email asli** BCA/Jago (rujukan parser).
- `TRACKSTER_AI_FEATURES_PLAN.md` — konvensi AI (tool-calling, cron, reuse helper). Status: selesai.
- `design_system/` — token, guideline, `handoff/README.md`.

## Drift yang ketemu (belum dibenerin)
- `CLAUDE.md` nyebut folder `design-system/`, aslinya `design_system/`.
- ~~`.env.example` domain lama / env belum lengkap~~ — dirapikan 2026-10-06 (multi-user F0). `TELEGRAM_BOT_TOKEN` di compose prod tidak dibaca kode.
- `Source.GOPAY` masih di enum & tipe frontend walau nggak ada sumber aktif.

## Multi-user (transisi, F0–F1 selesai di branch `feat/multi-user`, belum di prod)
- Skema: `User` + role/status/displayName/fullName/tokenVersion; semua tabel tenant punya `userId Int?` (nullable, FK Restrict) — kode runtime BELUM memakainya (F2). Tabel baru (belum dipakai): `Invite, OneTimeToken, ApiToken, InboundAddress, OwnAccount, TelegramLink(+Code), AiUsage`.
- Alat (di `apps/backend`): `npm run check` (semua `*.check.ts`), `npm run tenancy-audit` (daftar kerja scoping), `npm run golden`/`isolation-e2e` (`scripts/`), `prisma/data-fixes/{verify-backfill,2026-10-multiuser-backfill-owner}.js`, `prisma/provision-user.js`. Detail & status: `docs/multi-user/08-Progress-Log.md`.
- **F2 (scoping backend, di branch):** semua service tenant menerima `userId` sebagai parameter pertama; controller memakai `@CurrentUser()` (`common/decorators/current-user.decorator.ts`). Cron per user lewat `common/per-user.ts#forEachActiveUser`; jalur legacy tanpa konteks user (`/income/quick`, Gmail/`/sync/*`) memakai/mengunci ke pemilik (`common/owner.ts`). Upsert-by-unique-global diganti `findFirst`+`update/create` sampai C1. **Jangan buat user kedua sebelum C1** (unik global masih ada) — lihat Progress Log 2026-10-06 (lanjutan).

