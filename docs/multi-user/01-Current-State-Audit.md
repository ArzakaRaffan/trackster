# 01 — Audit Kondisi Saat Ini (snapshot 2026-10-05)

Hasil membaca kode, bukan asumsi. Skala: ±8.100 baris di `modules/*/*.service.ts|controller.ts`, **56 file backend** memakai Prisma,
~230 pemanggilan Prisma terhadap ±35 model. **Satu-satunya** modul yang saat ini membaca identitas user dari request adalah
`split-bill` dan `trip` (`(req as any).user.sub`). **Semua modul lain tidak tahu siapa penggunanya** — seluruh scoping adalah pekerjaan baru.

## 1. Auth hari ini

- `common/guards/jwt-auth.guard.ts` — baca cookie `trackster_jwt`, verifikasi, set `request.user = payload` (`{ sub, username }`).
  Tidak mengecek DB (user dihapus/dinonaktifkan tetap lolos sampai JWT 7 hari habis). Dipasang **per controller**, tidak ada global guard.
- `modules/auth/auth.service.ts` — `findUnique({ username })` + bcrypt; JWT `expiresIn: '7d'`. Tidak ada register, ganti/reset password, rate limit.
- `auth.controller.ts` — cookie `httpOnly`, `secure` di prod, `sameSite: 'lax'`, `domain: COOKIE_DOMAIN`.
- `prisma/seed.js` — membuat 1 user dari `ADMIN_USERNAME/ADMIN_PASSWORD`, **7 baris `DailyBudget` Rp50.000 global**, `BankBalance` BCA & JAGO @0 global. Seed **tidak otomatis** di prod.
- `@nestjs/throttler` terpasang tapi hanya di `SplitBillModule` (`ThrottlerModule.forRoot([{ ttl: 600_000, limit: 5 }])`) dan `TripModule`. **Jangan dijadikan global begitu saja** — limit 5/10 menit itu untuk pembuatan split bill publik.
- Frontend: `middleware.ts` (redirect `/login` kalau tak ada cookie, kecuali path publik), `lib/api.ts` (401 → panggil `/auth/logout` lalu `window.location = '/login'`).

## 2. Model Prisma → perubahan yang dibutuhkan

Legenda: **+uid** = tambah `userId` (FK ke `User`, index) · **uniq** = ubah constraint unik · **via parent** = scope lewat relasi induk (tetap
wajib dites) · **publik** = sengaja bisa diakses tanpa login (jangan rusak).

| Model | Kondisi sekarang | Perubahan |
| --- | --- | --- |
| `User` | `id, username @unique, password, createdAt` | + `role`, `status`, `fullName`, `displayName`, `email?`, `tokenVersion`, `onboarding*`; lihat 02 §1 |
| `Transaction` | `emailId @unique`, index `occurredAt`, `merchantKey` | **+uid**; `emailId @unique` → `@@unique([userId, emailId])`; index `[userId, occurredAt]`, `[userId, merchantKey]`. (Query terbanyak: 51 panggilan.) |
| `Reimbursement` | via `transactionId` (cascade) | **+uid** (di-query mandiri by `status`); validasi `transaction.userId == userId` |
| `DailyBudget` | `dayOfWeek @unique` | **+uid**; `@@unique([userId, dayOfWeek])` |
| `BudgetSetting` | PK `id` default 1 (singleton!) `findUnique({id:1})` | **+uid**, `userId @unique`; id auto-increment; hapus asumsi `id=1` |
| `EmailSyncLog` | global log | **+uid** (nullable → owner/legacy); dipakai halaman sync owner |
| `EmailParseLog` | `emailId @unique` | **+uid**; `@@unique([userId, emailId])`; index `[userId, status]`, `[userId, receivedAt]` |
| `TelegramConfig` | singleton `findFirst()`; simpan `botToken`, `chatId` | diganti `TelegramLink` (lihat 02 §5) atau **+uid unique** |
| `GmailToken` | singleton `findFirst()`, `deleteMany()` **tanpa where** | **+uid unique**; owner-only legacy; `disconnect()` wajib `where: { userId }` (kalau tidak, menghapus token semua user) |
| `AlertLog` | `@@unique([date])` | **+uid**; `@@unique([userId, date])` |
| `Income` | `externalId @unique` | **+uid**; `@@unique([userId, externalId])`; index `[userId, receivedAt]`, `[userId, streamId, periodStart]` |
| `IncomeStream` | tidak ada user | **+uid** |
| `BankBalance` | `source @unique` | **+uid**; `@@unique([userId, source])` |
| `BalanceAdjustment` | index `source` | **+uid**; index `[userId, source, createdAt]` (dipakai aturan baseline) |
| `MerchantAlias` | `rawDescription @unique` | **+uid**; `@@unique([userId, rawDescription])` |
| `CategoryIcon` | PK `category` | **+uid**; PK → `@@id([userId, category])` |
| `SplitBill` (+Participant/Item/ItemShare) | sudah ada `createdByUserId Int?`, `ownerToken`, `publicSlug` | **publik**. Tambah FK relasi ke `User` (opsional); pastikan semua endpoint privat memfilter `createdByUserId`. Jangan ubah alur anonim/slug/ownerToken |
| `Trip` (+Member/Expense/ExpenseShare) | idem (`createdByUserId`) | idem |
| `HealthScoreLog` | `weekStart @unique` | **+uid**; `@@unique([userId, weekStart])` |
| `BudgetAdvice` | `weekStart @unique` | **+uid**; `@@unique([userId, weekStart])` |
| `AiInsightCard` | `@@unique([rangeKey, dayKey])` | **+uid**; `@@unique([userId, rangeKey, dayKey])` |
| `PeriodReport` | `@@unique([period, periodStart])` | **+uid**; `@@unique([userId, period, periodStart])` |
| `Goal` | tidak ada user | **+uid** |
| `GoalContribution` | via `goalId` | via parent (Goal) — validasi kepemilikan goal |
| `Subscription` | tidak ada user; `googleCalendarEventId` | **+uid**; Calendar = owner-only (P11) |
| `ChatThread` | tidak ada user; Telegram = "satu thread per channel" | **+uid**; "thread Telegram" → satu per `(userId, channel)` |
| `ChatMessage` | via `threadId`; kolom `search tsvector` + **`$queryRaw`** di `ai/retrieval.service.ts:42` | via parent, **tapi raw SQL wajib join `ChatThread` + filter `userId`** (titik kebocoran #1) |
| `AiMemory` | tidak ada user | **+uid** |

Enum `Source` (BCA, JAGO, GOPAY, BNI, MANDIRI, RAYA, BRI) dan `Category` tetap global (bukan data user).

**Tabel baru** (lihat 02 §1): `Invite`, `ApiToken`, `InboundAddress`, `OwnAccount` (rekening milik user), `TelegramLink`, `AiUsage`,
(opsional) `PasswordResetToken` — atau satu tabel `OneTimeToken` untuk undangan & reset.

## 3. Titik rawan kebocoran lintas-user (grep 2026-10-05)

Pemanggilan Prisma tanpa filter yang pasti salah di multi-user (harus diperbaiki, daftar bukan tuntas — Fase 2 menjalankan audit statis penuh):

| Lokasi | Masalah |
| --- | --- |
| `gmail/gmail-auth.service.ts:47,63,68,73` | `gmailToken.findFirst()` / `deleteMany()` tanpa where (singleton + hapus-semua) |
| `telegram/telegram.service.ts:13,28,~51,~76` | `telegramConfig.findFirst()` — kirim alert ke chat user pertama saja |
| `budget/budget.service.ts:60,143,…` | `dailyBudget.findMany()`, `bankBalance.findMany()`, `findUnique({dayOfWeek})`, `budgetSetting id:1` |
| `analytics.service.ts:89`, `financial-snapshot.service.ts:83`, `budget-allocation.service.ts:102`, `income.service.ts:274` | `dailyBudget.findMany()` tanpa where |
| `merchant-alias/merchant-alias.service.ts:68,72` | `categoryIcon.findMany()`; `deleteMany({ where:{category} })` — kategori global |
| `transaction/transaction.service.ts:181` | `transaction.updateMany({ where, data })` ("terapkan kategori ke semua") — `where` harus memuat `userId` |
| `ai/ai-memory.service.ts:71` | `aiMemory.updateMany` (arsip) |
| `ai/retrieval.service.ts:42` | raw SQL tsvector atas semua `ChatMessage` |
| `income/income.service.ts` `classify()` | `incomeStream.findMany({isActive})` dan korelasi `EmailParseLog` **tanpa user** — akan mencocokkan/menyilang email user lain |
| `income/income.service.ts` ~`createFromParsed`, `transaction.service.ts` `createFromParsed` | dedup `emailId` global |
| `gmail-sync.service.ts` `checkAndAlertIfOverBudget` | `alertLog.findUnique({ date })` global |
| `gmail/gmail.controller.ts` `GET /gmail/callback` | **Tanpa JWT** (callback OAuth) → `handleCallback(code)` menyimpan refresh token ke `GmailToken` tanpa tahu siapa pemulai alur. Siapa pun yang menyelesaikan OAuth dengan akun Google-nya bisa menimpa token (sudah berisiko hari ini). Perlu `state` bertanda tangan atau hapus jalur (04 §B catatan; 05 T11) |
| Endpoint `trigger-*` (`ai/reports/trigger-weekly`, `ai/reports/trigger-health-score`, `budget-allocation/trigger-weekly`, `income/checkin/trigger-prompt|reminder`) | Hari ini memicu job untuk "satu-satunya user"; harus hanya memproses **user pemanggil**, bukan semua user |

## 4. Hardcode ke Arzaka / singleton

| Hal | Lokasi | Dampak multi-user |
| --- | --- | --- |
| `OWNER_FULL_NAME`, `OWNER_ACCOUNT_NUMBERS` | `gmail/parsers/own-accounts.ts` — konstanta **tingkat modul** dari env, fungsi `isInternalDestination/isOwnAccountNumber/isOwnerName` dipanggil langsung oleh `bca|bni|bri|flip|jago|mandiri.parser.ts` dan `income.service.ts` (`classify`) | Parser harus menerima **konteks pemilik** per pemanggilan (pure function), bukan env. `parsers.check.ts:17` men-set `process.env.OWNER_FULL_NAME` → tes harus diubah ke konteks eksplisit |
| Nama "Arzaka" di prompt AI | `ai/ai-anomaly|ai-budget-reminder|ai-budget|ai-caption|ai-chat|ai-finance-tools|ai-insight-card|ai-reports|financial-snapshot.service.ts`, `goal.service.ts`, `report.service.ts` | Ganti dengan `displayName` user |
| "Arzaka" di frontend | `components/v3/logic.tsx` (peserta awal wizard Split Bill `{ name:'Arzaka' }`), `views/ModalView.tsx` | Ganti dengan nama user dari `/auth/me` (jangan di zona `/demo`, yang tetap contoh) |
| Query Gmail hardcode bank | `gmail-sync.service.ts` (`GMAIL_QUERY_RECENT`, `buildQuery`) | Hilang untuk forwarding; allowlist domain bank pindah ke modul ingest |
| Telegram webhook | `telegram-webhook.controller.ts` — satu `TELEGRAM_WEBHOOK_SECRET` global, `chatId` dibandingkan ke **satu** config; `aiChatService.handleMessage(text,{channel:'telegram'})` tanpa user | Pecah user dari `chatId` → `TelegramLink`; semua handler (chat, callback check-in, callback `ba:`) butuh `userId` |
| `QUICK_INCOME_SECRET` | `income/income.controller.ts:33` (`POST /income/quick`) — menerima `process.env.QUICK_INCOME_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, **dan `JWT_SECRET`**; kunci bisa dari body/query/header | Ganti ApiToken per user; rotasi secret (lihat 00 §D) |
| Seed global | `prisma/seed.js` | Pindah ke `provisionUser(userId)` (default budget 7 hari, saldo awal, BudgetSetting) |
| `docker-compose.prod.yml` env | `OWNER_FULL_NAME`, `OWNER_ACCOUNT_NUMBERS`, `ADMIN_*`, `GMAIL_*`, `TELEGRAM_BOT_TOKEN` | Env baru: lihat 02 §9; env lama dihapus bertahap (jangan hapus sebelum kode berhenti memakainya — `.env` VPS manual) |
| `data-fixes/2026-09-backfill-merchant-key.ts` | script global | Kalau dijalankan ulang harus per-user-aman (catat di runbook) |

## 5. Job terjadwal saat ini (`@nestjs/schedule`, zona `Asia/Jakarta`)

| Cron | File | Catatan |
| --- | --- | --- |
| `*/5 * * * *` `gmail-sync` | `gmail/gmail-sync.service.ts` | Satu mailbox global → owner-only lalu dihapus (P3) |
| `0 22 * * *` `daily-recap` | `ai/ai-reports.service.ts` | Telegram — per user |
| `10 7 * * 1` `weekly-goal-nudge` | idem | per user |
| `30 20 * * *` `monthly-subscription-review` | idem | per user (eksekusi hari terakhir bulan) |
| `0 6 * * 1` `close-weekly-report` / `30 6 1 * *` `close-monthly-report` | idem | **menulis `PeriodReport`** — per user, idempotent |
| `0 7 * * 1` `weekly-insight-report` / `0 7 1 * *` `monthly-report-card` | idem | per user (+ `HealthScoreLog`) |
| `0 19 * * 0` `income-checkin-prompt` / `0 12 * * 1` `income-checkin-reminder` | `income-checkin/income-checkin-reminder.service.ts` | per user |
| `10 21 * * 0` `budget-suggestion-followup` | `ai/ai-budget-reminder.service.ts` | per user |
| `0 21 * * 0` `weekly-budget-allocation` | `budget-allocation/budget-allocation.service.ts` | per user (mengubah `DailyBudget`!) |

Total 12 cron. Setiap job membuka panggilan AI + Telegram → dengan N user bebannya ×N pada jam yang **sama** (Minggu 19:00–21:10,
Senin 06:00–07:10). Lihat 02 §7 (runner per-user berurutan, jitter, concurrency 1–2).

## 6. Ketergantungan Gmail OAuth selain email

`GmailAuthService` melayani **dua** hal: Gmail (sync) dan **Google Calendar** (`getCalendarClient()` → reminder `Subscription`, kolom
`googleCalendarEventId`). Scope: `gmail.readonly`, `calendar.events`, `userinfo.email`, `openid`. Menghapus OAuth untuk user baru = Calendar
hilang untuk mereka (keputusan P11/O9). Frontend: tombol sambung Gmail di Setting; FAQ "Apakah aman Trackster membaca email bank?" ada di `logic.tsx`
(perlu ditulis ulang untuk model forwarding).

## 7. Frontend yang perlu diperhatikan

- Layar pra-app (`/`, `/login`, `/setup`) di `logic.tsx` = **tampilan saja** (Daftar, Masuk Google, Lupa password, Wizard, Harga/Plus). Wizard saat ini tidak menulis apa pun.
- Hook data: `components/v3/live/useLive.ts` (SWR ke backend → bentuk state prototipe). `refresh = () => mutate(() => true)`.
- **Bahaya perangkat bersama:** cache SWR hidup di memori halaman — saat logout lalu login user lain **di tab yang sama** (tanpa reload),
  data user sebelumnya bisa tampil. Logout wajib `window.location` penuh (reload) atau `mutate(() => true, undefined, { revalidate:false })`.
  Saat ini 401 sudah redirect penuh; logout manual perlu dicek.
- `localStorage`: `v3-theme`, `v3-coach-hide` (preferensi per-perangkat, bukan per-user), `splitBillHistory` (tool publik). Coach mark "hide" kini
  per-perangkat; di multi-user sebaiknya state onboarding di server (07).
- `middleware.ts`: path publik eksplisit; halaman baru (`/invite/[code]`, `/reset/[token]`) harus ditambahkan ke daftar publik.
- Generator: `views/*`, `V3Tree.tsx`, `pseudo.css` **digenerate** `scripts/dc-to-tsx.mjs` — jangan edit tangan; ubah sumber desain/generator
  (`docs/Rework Design Trackster/`) lalu regenerate. Logika di `logic.tsx` dirawat tangan.

## 8. Infra & CD

- CD: push `main` → build image di GitHub runner → push ke GHCR → SSH VPS → `docker compose pull && up -d`. **Tidak ada langkah tes** di workflow (`deploy.yml`).
  Fase 0 mengusulkan job `check` (build + `npm run check`) sebelum `build`.
- Backend CMD: `npx prisma migrate deploy && node dist/main` → migrasi otomatis saat container start. 33 entri di `prisma/migrations/` (terbaru `20261005160000_add_bri_source`).
- Postgres prod di compose yang sama (volume `trackster_pg_data`, port 127.0.0.1:5432). Dev DB: `docker-compose.yml` (port 5434, project `trackster-dev`, lihat CAUTION).
- Nginx: `nginx/conf.d/trackster.conf` sudah `trackster.dev` + `api.trackster.dev`, redirect domain lama `track.trackster.my.id` & `api.track.trackster.my.id`; `client_max_body_size 20M` di API. Sertifikat Let's Encrypt via certbot (HTTP-01 `/.well-known/acme-challenge/`).
- **DNS** `trackster.dev`: nameserver saat ini **name.com** (`ns1bcp.name.com` dst., dicek 2026-10-05). Keputusan D3: pindah ke Cloudflare.
- Tidak ada test runner; pola verifikasi = `*.check.ts` (19 file, assert murni) + verifikasi hidup manual.
- Branch: `main` + `feat/v3-redesign` lokal; 5 branch `ai-agent/*` remote-only (bukan bagian migrasi ini).

## 9. Hal yang sudah mendukung multi-user (jangan dibuat ulang)

- `IncomeStream` (cadence WEEKLY/MONTHLY/NONE; kind FIXED/SESSION/DEDUCTION/VARIABLE/IRREGULAR; `payDayOfWeek/payDayOfMonth`) — forecast
  mingguan sudah menangani stream bulanan (`income-forecast.service.ts`, cek `payDayOfMonth` di minggu berjalan).
- `SplitBill`/`Trip` publik dengan `createdByUserId` + `ownerToken` + `publicSlug`.
- JWT `sub = user.id` sudah dikeluarkan — tinggal dibaca.
- Wizard pra-app & layar Daftar/Lupa password sudah ada sebagai tampilan (butuh dihubungkan, bukan dirancang ulang).
- `Source` enum sudah mencakup banyak bank; parser BNI/Mandiri/Raya/BRI baru ditambahkan (commit terbaru).

## 10. Hal yang BELUM terverifikasi (harus dicek sesi terkait, jangan diasumsikan)

1. `id` user Arzaka = 1? (`SELECT id, username FROM "User";` di DB prod/restore.)
2. Nilai `TELEGRAM_BOT_TOKEN` di `.env` VPS sama dengan token di tabel `TelegramConfig`?
3. Format email **hasil forward Gmail**: header `From`/`Reply-To` asli terjaga? `Authentication-Results`/DKIM bank masih valid? Header `X-Forwarded-For`?
   Harus diuji dengan email nyata (anonimkan sebelum dijadikan fixture) — Fase 7.
4. Dukungan Cloudflare Email Routing untuk **subdomain** (`in.trackster.dev`), batas ukuran email & batas CPU Email Worker pada plan gratis — baca dokumentasi Cloudflare terbaru saat Fase 7.
5. Format tepat email konfirmasi forwarding Gmail (pengirim/subjek/kode) — uji langsung.
6. Apakah ada record DNS lain di name.com (MX apex, TXT, CAA) & DNSSEC (O1).
7. Perilaku semua service dengan data **kosong** (user baru): pembagian dengan nol, `findFirstOrThrow`, forecast tanpa stream, health score tanpa budget — Fase 8 "zero-state sweep" (04 §D).
8. Apakah ada tempat lain yang memakai `Transaction.emailId` sebagai Gmail message ID (mis. link ke Gmail)? (`grep emailId`).
