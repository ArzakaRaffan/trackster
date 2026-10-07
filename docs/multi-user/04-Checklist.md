# 04 — Checklist Lintas-Fase

Centang `[x]` hanya setelah diverifikasi. `[~]` = tercakup tes isolasi HTTP (`isolation-e2e`) tapi belum ada `*.check.ts` khusus/dua-user. Daftar rute diambil dari kode 2026-10-05 — **jika kode berubah, perbarui tabel** (rute baru wajib
ditambahkan ke matriks isolasi sebelum merge).

## A. Daftar model tenant (input skrip audit statis `tenancy-audit`)

`Transaction, Reimbursement, DailyBudget, BudgetSetting, EmailSyncLog, EmailParseLog, TelegramConfig/TelegramLink, GmailToken, AlertLog, Income, IncomeStream,
BankBalance, BalanceAdjustment, MerchantAlias, CategoryIcon, HealthScoreLog, BudgetAdvice, AiInsightCard, PeriodReport, Goal, GoalContribution(via Goal),
Subscription, ChatThread, ChatMessage(via ChatThread), AiMemory, ApiToken, InboundAddress, OwnAccount, AiUsage.`
Pengecualian **sengaja** (publik, jangan di-scope pada jalur anonim): `SplitBill*`, `Trip*` pada endpoint `public/*` & `manage/:ownerToken/*`; keduanya tetap difilter `createdByUserId` pada jalur privat.

## B. Matriks scoping per modul (Fase 2)

Kolom: **Svc** = semua method service ber-`userId` & `where` memuat `userId` · **Ctl** = controller memakai `@CurrentUser()` · **Job** = pemanggil non-HTTP (cron/ingest/telegram) memberi `userId` · **Chk** = `*.check.ts` diperbarui/ditambah.

| Modul | File inti | Svc | Ctl | Job | Chk | Catatan khusus |
| --- | --- | --- | --- | --- | --- | --- |
| balance | `balance.service.ts` | [x] | [x] | [x] | [~] | `adjustBalance`/`getLastManualAdjustmentAt` per `(user, source)`; `balance.check.ts` +2 user |
| budget | `budget.service.ts`, `budget-advisor`, `budget-rollover` | [x] | [x] | [x] | [~] | hapus `budgetSetting id:1`; `dailyBudget` by `(userId, dayOfWeek)`; `getTodaySummary(userId)` |
| merchant-alias | `merchant-alias.service.ts` | [x] | [x] | [x] | [~] | `rawDescription` unik per user; `categoryIcon` per user; `findCategoryForDescription(userId, …)` dipakai sync |
| goal | `goal.service.ts` | [x] | [x] | [x] | [~] | contribute/archive/simulate validasi pemilik; prompt "Arzaka" |
| subscription | `subscription.service.ts` | [x] | [x] | [x] | [~] | Calendar owner-only (P11) |
| reimbursement | `reimbursement.service.ts` | [x] | [x] | [x] | [~] | validasi `transaction.userId`; saldo `receivedSource` per user |
| income-stream | `income-stream.service.ts` | [x] | [x] | [x] | [~] | |
| income | `income.service.ts` | [x] | [x] | [x] | [~] | `classify(userId,…)`, korelasi `EmailParseLog` per user, `createFromParsed`, `resolve`, `remove` |
| income-forecast | `income-forecast.service.ts` | [x] | [x] | [x] | [~] | `income-forecast.check.ts` |
| income-checkin | `income-checkin.service.ts`, `…-reminder.service.ts` | [x] | [x] | [x] | [~] | cron per user; callback Telegram by user |
| transaction | `transaction.service.ts` (51 panggilan Prisma) | [x] | [x] | [x] | [~] | `createFromParsed(userId,…)`, `getInsights(userId)`, `updateMany` kategori, dedup `(userId,emailId)` |
| budget-allocation | `budget-allocation.service.ts` | [x] | [x] | [x] | [~] | menulis `DailyBudget` per user |
| analytics | `analytics.service.ts` | [x] | [x] | [x] | [~] | `getPeriodStats(userId, …)`; `period-stats.check.ts` |
| report | `report.service.ts` | [x] | [x] | [x] | [~] | `PeriodReport` unik `(userId, period, periodStart)`; `/reports/export.csv` hanya data user |
| ai/finance-tools | `ai-finance-tools.service.ts` | [x] | n/a | [x] | [~] | `userId` terikat server; `logExpense` menulis ke user ini |
| ai/chat+threads | `ai-chat.service.ts`, `ai.controller.ts` | [x] | [x] | [x] | [~] | thread by-id → cek `userId`; stream SSE juga |
| ai/memory | `ai-memory.service.ts` | [x] | [x] | [x] | [~] | `updateMany` arsip + `userId` |
| ai/retrieval | `retrieval.service.ts` | [x] | n/a | [x] | [~] | **raw SQL** + join thread |
| ai/caption,anomaly | `ai-caption`, `ai-anomaly` | [x] | n/a | [x] | [~] | notifikasi Telegram per user |
| ai/insight-card,snapshot,budget | `ai-insight-card`, `financial-snapshot`, `ai-budget`, `ai-budget-reminder` | [x] | [x] | [x] | [~] | cache unik `(userId,…)` |
| ai/reports (cron) | `ai-reports.service.ts` | [x] | [x] | [x] | [~] | 7 cron → runner per user (F4) |
| telegram | `telegram.service.ts`, `telegram-webhook.controller.ts`, `telegram.controller.ts` | [x] | [x] | [x] | [~] | `chatId→userId`; `/start <kode>` |
| sync | `sync.controller.ts` | [x] | [x] | [x] | n/a | owner-only legacy; hapus di F7 |
| gmail | `gmail-auth.service.ts`, `gmail-sync.service.ts`, `gmail.controller.ts` | [x] | [x] | [x] | [~] | `state` OAuth bertanda tangan (lihat §catatan); hapus di F7 |
| split-bill | `split-bill.service.ts` | [ ] | [ ] | n/a | [ ] | verifikasi `createdByUserId`; publik tak berubah |
| trip | `trip.service.ts` | [ ] | [ ] | n/a | [ ] | idem; (tidak ada endpoint list privat saat ini) |
| auth | `auth.*` | [ ] | [ ] | n/a | [ ] | F5 |
| (baru) ingest/inbound/api-token/onboarding/user-profile | — | [ ] | [ ] | [ ] | [ ] | F3/F6/F7/F8 |

> **Catatan Gmail callback:** `GET /gmail/callback` **tanpa JWT** menyimpan refresh token ke `GmailToken` tanpa tahu siapa yang memulai alur — di kondisi saat ini siapa pun yang menyelesaikan OAuth bisa menimpa token. Di Fase 2 ikat dengan `state` bertanda tangan (berisi `userId` + nonce + kedaluwarsa) atau percepat penghapusan jalur ini. Catat di Progress Log.

## C. Matriks tes isolasi endpoint (Fase 2+, `isolation-e2e.ts`)

Setup: user A (data lengkap: transaksi, income, goal, thread, memori, alias, …) dan user B (kosong). Untuk **setiap** rute di bawah, tes:
(1) sebagai B, rute list **tidak** mengembalikan data A; (2) sebagai B, rute dengan `:id`/`:source`/`:date` milik A → **404/403** dan data A tak berubah;
(3) tanpa cookie → 401 (kecuali publik). Centang `[x]` di kolom **Iso** bila ketiganya lulus.

| Controller | Rute | Iso |
| --- | --- | --- |
| `ai` | GET mascot-tip, snapshot, memory, threads, threads/:id/messages, insight-card, health-score/history, budget-suggestions · POST memory, chat, threads, threads/:id/messages, threads/:id/messages/stream, suggest-category, reports/trigger-weekly, reports/trigger-health-score · PATCH memory/:id, threads/:id · DELETE memory/:id, threads/:id | [ ] |
| `analytics` | GET stats | [ ] |
| `auth` | POST login, logout · GET me · (baru) register, change-password, reset-password, logout-all | [ ] |
| `balance` | GET `/` · PUT `:source` · GET `:source/adjustments` | [ ] |
| `budget-allocation` | GET preview · POST trigger-weekly | [ ] |
| `budget` | GET `/`, rollover, today, runway, suggestions · PUT `/`, rollover · POST apply | [ ] |
| `gmail` (legacy) | GET auth-url, callback, status · POST disconnect | [ ] |
| `goal` | GET `/` · POST `/`, `:id/contribute`, `:id/simulate` · PATCH `:id/archive` | [ ] |
| `income/checkin` | GET `/` · POST `/`, trigger-prompt, trigger-reminder | [ ] |
| `income/forecast` | GET week, horizon | [ ] |
| `income-streams` | GET `/` · POST `/` · PUT `:id` · DELETE `:id` | [ ] |
| `income` | GET `/`, allocation · POST `/`, **quick (dihapus F6)** · PUT `:id` · DELETE `:id` · PATCH `:id/resolve` | [ ] |
| `merchant-aliases` | GET `/`, category-icons · POST `/` · PUT icon, category-icons, `:id` · DELETE `:id` | [ ] |
| `reimbursements` | GET `/` · POST `/`, `:id/received` · DELETE `:id` | [ ] |
| `reports` | GET `/`, aggregate, records, export.csv | [ ] |
| `subscriptions` | GET `/` · POST `/` · PUT `:id` · DELETE `:id` | [ ] |
| `sync` (legacy) | POST trigger, backfill · GET next-run, logs, parse-log | [ ] |
| `telegram` | GET status · PUT config · POST test · (webhook publik `POST webhook/:secret` → tes dengan 2 chatId) | [ ] |
| `transactions` | GET `/`, subscriptions, weekly, monthly, summary, `day/:date`, insights, uncategorized-merchants, `:id/same-merchant-count` · POST `/` · DELETE `:id` · PATCH `:id/note`, `:id/category`, `:id/alias`, `:id/big` | [ ] |
| `split-bills` (privat) | POST `/`, scan-receipt · GET `/`, `:id` · PATCH `:id/items/:itemId/assign` | [ ] |
| `split-bills` (publik) | POST public · GET manage/:ownerToken, public/:slug · PATCH manage/…, public/…/mark-paid — **tak berubah; tes bahwa tetap bekerja tanpa login** | [ ] |
| `trips` | POST `/` (privat) · POST public, GET manage/:ownerToken, public/:slug, PATCH manage/…/expenses (publik) | [ ] |
| (baru) `ingest` | POST transaction, income (Bearer ApiToken; `email` = F7) | [x] `ingest-e2e` (18 skenario, 2026-10-07) + 401 tanpa token di `isolation-e2e` |
| (baru) `api-tokens` | GET/POST/DELETE | [x] `ingest-e2e` (A tak bisa cabut token B → 404) + 401 tanpa cookie di `isolation-e2e` |
| (baru) `onboarding`/`profile`/`own-accounts` | semua | [ ] |

Tambahan tes lintas-rute: (a) **dua user, dua sesi bersamaan** — tindakan A tak memengaruhi B (saldo, budget today, alert log, rollover); (b) hapus transaksi A tak menyentuh saldo B;
(c) AI chat B bertanya "transaksi terbesar saya" → hanya data B (isi data A dengan nilai khas yang mudah dikenali); (d) retrieval/search chat tidak menemukan pesan A.

## D. Zero-state sweep (Fase 8) — akun benar-benar kosong

Untuk setiap layar/endpoint: tidak ada 500, NaN, Infinity, `undefined`, grafik kosong yang rusak, atau teks "Arzaka". Empty-state punya tindakan ("Tambah pemasukan pertama").
Daftar layar (route frontend, Codemap): [ ] `/app` [ ] `/app/today` [ ] `/app/weekly` [ ] `/app/budget` [ ] `/app/income` [ ] `/app/income/checkin` [ ] `/app/goals`
[ ] `/app/subscriptions` [ ] `/app/reports` [ ] `/app/insights` [ ] `/app/chat` [ ] `/app/chat/memory` [ ] `/app/categorize` [ ] `/app/more` [ ] `/app/split`
[ ] `/app/calc` [ ] `/app/sources` [ ] `/app/privacy` [ ] `/app/settings`.
Backend yang rawan pembagian nol/`OrThrow`: health score (budget 0), `getTodaySummary` (budget 0), `runway`, forecast tanpa stream, analytics `getPeriodStats` kosong, `PeriodReport` periode tanpa data,
`budget-advisor`, `budget-allocation`, `plan-simulator`, `income-checkin` tanpa stream, AI tools tanpa data, `ai-insight-card`, `mascot-tip`.
Skenario data: (1) kosong total; (2) hanya saldo awal; (3) 1 transaksi; (4) pemasukan **bulanan** saja; (5) pemasukan **mingguan** saja; (6) campuran; (7) stream `IRREGULAR` saja.

## E. Dokumentasi yang HARUS diperbarui (tiap akhir fase yang relevan)

| Dokumen | Apa | Fase pemicu |
| --- | --- | --- |
| `docs/multi-user/03-Roadmap.md` | centang tugas | semua |
| `docs/multi-user/08-Progress-Log.md` | entri sesi | semua |
| `docs/multi-user/00-Decisions.md` | status keputusan, keputusan baru | kapan pun |
| `docs/multi-user/02-Target-Architecture.md` | bila desain berubah | kapan pun |
| `docs/context/Codemap.md` | modul/route/cron baru, `userId`, drift domain | F1–F8 |
| `docs/context/Architecture.md` | tabel "Modul utama", Data flow (forwarding, ingest), Database, **Batas sistem** ("Single-user" → multi-user invite-only), Integrasi eksternal (hapus Gmail, tambah Cloudflare) | F2, F3, F7, F9 |
| `docs/context/_Overview.md` | deskripsi (bukan lagi "single-user"), env wajib, cara jalan | F5, F7, F9 |
| `CLAUDE.md` | judul/ringkasan "Single-user app", Auth flow, Domain Logic (Parser Email Bank: sumber email kini forwarding; exclusion pakai profil user), Domain Logic Saldo (per user), Gotcha baru, Deployment (env baru, Cloudflare) | F0 (pointer), F3, F5, F7, F9 |
| `CAUTION.md` | URL cek prod (`trackster.dev`), catatan beban cron per user, aturan menjalankan skrip verifikasi | F0, F9 |
| `.env.example` | env baru/usang, domain | F0, F3, F6, F7 |
| `docker-compose.prod.yml` | env baru; hapus yang usang **setelah** kode tak memakai & `.env` VPS siap | F3, F6, F7 |
| `README.md` (root) | deskripsi produk, setup | F9 |
| `/app/privacy` + FAQ di `logic.tsx` | teks privasi & "aman membaca email?" | F8, F9 |
| `docs/Rework Design Trackster/PLAN.md` | bila layar wizard/auth diubah | F5, F8 |
| Memori Claude (`~/.claude/projects/.../memory`) | fakta non-obvious baru (opsional) | F9 |

## F. Checklist pre-merge (setiap fase, sebelum minta persetujuan merge ke `main`)

- [ ] `git status` bersih; hanya perubahan fase ini; tak ada rahasia/data pribadi/`.env`/dump/snapshot di diff (`git diff main --stat` + grep pola token/nomor rekening).
- [ ] Backend `NODE_OPTIONS=--max-old-space-size=1536 npm run build` ✔ (satu proses berat; dev DB mati sebelum build — CAUTION).
- [ ] Frontend `npx tsc --noEmit` ✔.
- [ ] `npm run check` ✔ (semua `*.check.ts`, termasuk yang baru).
- [ ] `tenancy-audit` ✔ (atau pengecualian beralasan). 
- [ ] `isolation-e2e` ✔ untuk rute yang disentuh.
- [ ] Golden snapshot Arzaka "sesudah" identik dengan "sebelum" (kecuali perubahan yang disengaja & dijelaskan).
- [ ] Verifikasi hidup di browser (flow fase ini) — console & network bersih.
- [ ] Migrasi: SQL ditinjau manual; diterapkan di DB restore; **tidak** ada `DROP`/`SET NOT NULL` di luar langkah C1; reversibel/ada rencana rollback tertulis.
- [ ] Backward-compatible: image lama + skema baru tetap jalan (selama window deploy).
- [ ] Docs §E diperbarui; Progress Log diisi; commit pesan jelas, per unit logis.
- [ ] Arzaka menyetujui merge secara eksplisit di chat.

## G. Checklist pre-deploy (sebelum push ke `main`)

- [ ] 🛟 Backup DB prod baru ([Runbook §1](06-Runbooks.md)), file & checksum dicatat.
- [ ] `.env` VPS sudah ditambah env baru yang dibutuhkan kode fase ini (Arzaka via SSH) — daftar ada di Progress Log fase tsb.
- [ ] Jam deploy sepi (hindari Minggu 19:00–21:10 & Senin 06:00–07:10 WIB — jendela cron padat).
- [ ] Rencana rollback tertulis (`IMAGE_TAG=<sha-sebelumnya>`; restore dump bila migrasi C1).
- [ ] RAM VPS lega (`free -h`); tidak ada dev server/dev DB yang masih nyala.

## H. Smoke test pasca-deploy

- [ ] `curl -I https://trackster.dev` & `curl -I https://api.trackster.dev/auth/me` (401 normal tanpa cookie).
- [ ] Login Arzaka → beranda memuat; saldo & budget hari ini sama seperti sebelum deploy.
- [ ] Log backend: `docker compose -f docker-compose.prod.yml logs --tail=100 backend` — tak ada error migrasi/Prisma.
- [ ] Cron berikutnya berjalan (cek log pada jadwalnya) / trigger manual endpoint yang relevan.
- [ ] (Fase 7+) email bank uji masuk dan tercatat; `lastEmailAt` ter-update.
- [ ] Jika gagal: **rollback dulu, diagnosis kemudian**.
