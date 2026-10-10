# 08 — Progress Log (append-only)

Setiap sesi **menambah entri di paling bawah** (jangan menulis ulang entri lama). Isi: tanggal, fase/tugas, apa selesai (dengan bukti verifikasi), apa belum,
deviasi dari rencana (+alasan), env baru yang Arzaka harus tambahkan, langkah berikutnya yang konkret. **Jangan menulis rahasia/nomor rekening/isi email/data finansial.**

**Template entri:**

```
## YYYY-MM-DD — <fase/tugas ID> — <singkat>
- Sesi oleh: <AI/Arzaka>   Branch: <nama>   Commit terakhir: <sha>
- Selesai: <ID tugas> (verifikasi: <build/check/isolasi/golden/browser>)
- Belum / tertunda: …
- Deviasi / temuan: …
- Keputusan baru atau perubahan status keputusan: … (sudah dicatat di 00-Decisions? ya/tidak)
- Env/aksi manual untuk Arzaka: …
- Docs yang diperbarui: …
- Langkah berikutnya (konkret, ≤ 2 menit untuk dimulai): …
```

---

## 2026-10-05 — Perencanaan — dokumen migrasi dibuat
- Sesi oleh: Claude (Sonnet 5.5) + Arzaka   Branch: `main` (docs saja, belum di-commit)
- Selesai: audit kode (auth, 56 file Prisma, 12 cron, parser, Telegram, Gmail OAuth, frontend wizard/auth, infra CD/Nginx/DNS) → dokumen `docs/multi-user/*` (README, 00–08).
- Temuan penting yang mengubah rencana awal:
  - Hanya `split-bill`/`trip` yang membaca `req.user`; **semua modul lain** perlu scoping dari nol → estimasi naik dari 1–1,5 minggu menjadi ±20–25 hari kerja fokus.
  - `GmailAuthService` juga melayani **Google Calendar** (reminder langganan, tidak ada reminder Telegram) → menghapus Gmail OAuth menghapus Calendar untuk user baru (P11/O9).
  - `POST /income/quick` menerima `JWT_SECRET` & `TELEGRAM_WEBHOOK_SECRET` sebagai kunci, kunci bisa lewat query string → rotasi `JWT_SECRET` setelah endpoint dihapus.
  - `GET /gmail/callback` publik tanpa `state` → siapa pun yang menyelesaikan OAuth bisa menimpa `GmailToken` (risiko sudah ada sekarang).
  - `TELEGRAM_BOT_TOKEN` diteruskan di compose tetapi tidak dibaca kode (token dibaca dari DB `TelegramConfig`).
  - `own-accounts.ts` memakai konstanta env tingkat modul; 6 parser + `income.service` memanggilnya langsung → refaktor ke konteks eksplisit.
  - `ai/retrieval.service.ts` memakai `$queryRaw` atas semua `ChatMessage` → titik kebocoran #1.
  - DNS `trackster.dev` masih di name.com (NS dicek 2026-10-05) → keputusan D3: pindah ke Cloudflare. Nginx & CD sudah memakai `trackster.dev`; `.env.example`/`CLAUDE.md`/`CAUTION.md` masih menyebut `trackster.my.id`.
  - Deploy CD tidak punya langkah tes; migrasi Prisma jalan otomatis saat container start.
- Keputusan: D1–D9 terkunci (lihat 00). P1–P14 **menunggu persetujuan Arzaka**; O1–O9 terbuka.
- Env/aksi manual: belum ada.
- Docs yang diperbarui: folder `docs/multi-user/` (baru), pointer di `CLAUDE.md`.
- Langkah berikutnya: Arzaka membaca README + 00-Decisions, menyetujui/menolak P1, P8, P13 (gerbang F0) dan menjawab O1 (DNS/DNSSEC name.com). Lalu mulai **P0-01** (branch `feat/multi-user`).

## 2026-10-06 — F0 (sebagian) + F1 P1-01..P1-04, P1-06, P1-07 — sesi malam, Arzaka tidur
- Sesi oleh: Claude (Sonnet 5.5)   Branch: `feat/multi-user` (turunan `main`, **belum di-push, belum merge**)   Commit terakhir: lihat `git log` (3 commit: docs, F0, F1)
- Dasar mulai: Arzaka minta "mulai dari step awal, beberapa step sekaligus". Saya menganggap itu persetujuan untuk **mulai F0/F1 di branch lokal** (P1, P8, P13 dipakai sebagai pendekatan kerja). **Status P1/P8/P13 di 00-Decisions TIDAK diubah ke LOCKED** — Arzaka masih perlu menyetujui eksplisit sebelum merge apapun.
- **Selesai (terverifikasi):**
  - P0-01 branch; P0-02 rapikan teks domain (`.env.example`, `CLAUDE.md`, `CAUTION.md`, Codemap → `trackster.dev`); P0-03 pointer (sudah ada).
  - P0-08 `npm run check` (`scripts/run-checks.mjs`): baseline **18/19 tanpa DB** (`retrieval.check.ts` butuh Postgres); **20/20 dengan DB** (+`provision-user.check.ts`).
  - P0-10 `npm run tenancy-audit`: baseline **208 temuan** di 30 file (`--summary` untuk ringkasan) = daftar kerja F2. Pengecualian sengaja: komentar `// tenancy-ok: <alasan>`.
  - P0-07 (alat) `scripts/golden-snapshot.mjs` (`take`/`diff`; 46 endpoint GET read-only, tanpa endpoint AI) — teruji: dua snapshot berturut-turut IDENTIK. P0-11 (kerangka) `scripts/isolation-e2e.mjs`: 106 rute privat tanpa cookie → 401 semua lulus.
  - P1-01/02 schema + migrasi `20261006100000_multiuser_expand` (SQL **murni tambah**: 0 DROP/SET NOT NULL/RENAME; dihasilkan `prisma migrate diff`, bukan `migrate dev`). P1-03 `20261006100100_multiuser_backfill` (UPDATE idempoten, no-op di DB kosong, tak pernah RAISE) + skrip data pribadi `prisma/data-fixes/2026-10-multiuser-backfill-owner.js` (dry-run default, `--apply`; membaca `OWNER_*` dari env; token bot tidak disalin). P1-04 `prisma/data-fixes/verify-backfill.js`. P1-06 `prisma/provision-user.js` + `seed.js` memakainya + `src/modules/user/provision-user.check.ts`.
  - Diuji di **cluster Postgres scratch lokal** (bukan prod, bukan DB dev Arzaka): DB pra-multiuser dengan data sintetis di 23 tabel → apply migrasi baru → `verify-backfill` NULL=0; deploy dari DB kosong OK; `migrate diff` tidak menunjukkan drift baru (hanya 3 drift lama: indeks tsvector/trgm raw-SQL, sama seperti sebelum perubahan); skrip owner idempoten (jalan 2× → tak ada duplikat); `seed.js` 2× idempoten; backend baru jalan di skema baru, 46 endpoint 200.
  - P1-07: build backend **bersih** (hapus `dist` + `tsconfig.tsbuildinfo` dulu) lolos; check 20/20.
- **Belum / tertunda (butuh Arzaka):**
  - P0-04 backup prod, P0-05 restore-drill data nyata, P0-06 cek id user Arzaka & token Telegram — butuh akses VPS.
  - P0-07 snapshot "sebelum" dengan data Arzaka; P1-05 uji pada restore data nyata.
  - P0-09 (job `check` di CD) ⛔ menunggu persetujuan; P1-08 merge/deploy F1 ⛔.
  - Frontend `tsc --noEmit` tidak dijalankan (tidak ada perubahan frontend).
- **Deviasi / temuan:**
  1. **Docker Desktop tidak mau start** (engine WSL berhenti; tak bisa diklik dari sesi ini). Pakai Postgres 17 native: cluster scratch `C:\tmp\pg-trackster-dev\data`, port **5434**, user/pw `trackster`, DB `trackster` (data sintetis, `owner_test`) & `trackster_empty`. Service Postgres milik Arzaka di 5432 tidak disentuh. Hidupkan: `"C:\Program Files\PostgreSQL\17\bin\pg_ctl" -D C:/tmp/pg-trackster-dev/data -o "-p 5434" start`; matikan: `... stop`. **Dimatikan di akhir sesi.**
  2. **`dist/` + `tsconfig.tsbuildinfo` basi membuat `npm run build` "lolos" tapi tidak mengeluarkan `dist/main.js`** (hanya `dist/modules`). Sebelum menganggap build valid: `rm -rf dist tsconfig.tsbuildinfo` lalu build. (Gotcha lama di CLAUDE.md, ternyata masih menggigit.)
  3. FK `SplitBill.createdByUserId`/`Trip.createdByUserId` → `User` **ditunda** (data lama bisa menyimpan id yatim → FK akan menggagalkan migrasi di prod). Tambahkan di C1 setelah dicek.
  4. `BudgetSetting` (PK singleton id=1) **tidak** dibuat oleh `provisionUser` — ditangani saat PK diubah (F2/F4). Sampai **C1** (unik global `DailyBudget.dayOfWeek`, `BankBalance.source`) user kedua **belum bisa di-provision**; urutan roadmap (C1 di akhir F4, register di F5) tetap benar.
  5. Migrasi backfill SQL **otomatis jalan saat deploy** (isi `userId` + `User.role='ADMIN'` untuk user dengan id terkecil). Baris yang dibuat kode lama sesudahnya (userId NULL) harus diisi ulang lewat skrip owner (`--apply`) sebelum F2 dan sebelum C1.
  6. `prisma format` ikut merapikan perataan model lama (diff schema lebih besar dari perubahan substansi).
  7. Skrip verifikasi ditulis `.mjs` (bukan `.ts`) agar tanpa ts-node/build; skrip yang harus jalan di container prod (`verify-backfill`, `backfill-owner`) ada di `prisma/` (satu-satunya folder selain `dist` yang disalin Dockerfile) dan plain JS.
- Keputusan baru / perubahan status: tidak ada (lihat catatan di atas soal P1/P8/P13).
- Env/aksi manual untuk Arzaka: tidak ada env baru. `.env` lokal tidak diubah.
- Docs yang diperbarui: `03-Roadmap.md` (centang + catatan), `Codemap.md`, `.env.example`, `CLAUDE.md`, `CAUTION.md`.
- **Langkah berikutnya (urut):** (1) Arzaka: setujui/tolak P1, P8, P13 di chat. (2) Arzaka/sesi dengan akses VPS: P0-04 → P0-05 → P0-06 (backup, restore ke DB dev, cek id user + token Telegram). (3) Sesi berikutnya: snapshot golden "sebelum" dari restore, ulangi P1-05 dengan data nyata, lalu minta persetujuan P1-08. (4) Setelah F1 live: mulai F2 dari `balance` (daun) — `npm run tenancy-audit -- --summary` adalah daftar kerjanya.

## 2026-10-06 (lanjutan) — F2 scoping backend (hampir semua P2-xx) — sesi malam, Arzaka tidur ("lanjutkan saja dulu")
- Sesi oleh: Claude (Sonnet 5.5)   Branch: `feat/multi-user` (belum di-push/merge)   Commit: lihat `git log` (commit "fase 2")
- Dasar: pesan Arzaka "lanjutkan saja dulu" → saya lanjut ke F2 **di branch lokal saja**. Prasyarat roadmap ("F1 sudah di prod") **belum terpenuhi**; tidak ada merge/push/DB prod. Saat Arzaka mau merge, urutannya tetap F1 dulu (P1-08), lalu F2.
- **Selesai (terverifikasi di scratch DB, bukan data nyata):** P2-01, 02, 03, 05, 06, 07, 09, 10; P2-04/11/12 sebagian (lihat Roadmap).
  - Semua service/controller tenant: `userId` parameter pertama; `@CurrentUser()` di controller; by-id memakai `findFirst/updateMany/deleteMany({id,userId})` → 404 (tidak membedakan "tak ada" vs "milik orang lain").
  - Cron (11 job non-Gmail) memakai `forEachActiveUser` (`common/per-user.ts`, versi minimal; jitter/konkurensi = F4); trigger manual (`/…/trigger-*`) hanya memproses **pemanggil**.
  - Cache `FinancialSnapshotService` yang tadinya satu-global → per user (akan bocor lintas user).
  - `/income/quick` (tanpa JWT) → user ADMIN pertama (`common/owner.ts`), dihapus F6. Gmail OAuth/`/sync/*` → **owner-only** (403 user lain) + `state` OAuth bertanda tangan.
  - Migrasi baru `20261006110000_budget_setting_id_sequence` (BudgetSetting id auto-increment, sequence disetel > MAX(id); aman untuk kode lama). `schema.prisma` ikut berubah.
  - Verifikasi: `tsc` bersih; build bersih (`dist`+`tsbuildinfo` dihapus dulu); `npm run check` 20/20 (retrieval.check kini dua user); `tenancy-audit` 208 → **0**; `isolation-e2e` **167 lulus** (dua user, A berdata/B kosong); backend boot (DI utuh); golden vs kode F1: 43/46 endpoint identik, 3 beda hanya karena data uji (dijelaskan: saldo/runway/thread dari sisa uji + baseline koreksi sintetis).
- **Temuan penting (baca!):**
  1. **Hazard pra-C1:** selama unik global masih ada (`BankBalance.source`, `DailyBudget.dayOfWeek`, `PeriodReport(period,periodStart)`, `AlertLog.date`, `HealthScoreLog/BudgetAdvice.weekStart`, `AiInsightCard`, `MerchantAlias.rawDescription`, `CategoryIcon.category`, `Transaction/Income/EmailParseLog` id email, `TelegramConfig`…), **user kedua yang menulis baris itu bisa 500 — dan bisa memblokir tulisan user pertama** (terbukti di uji: `/reports/aggregate` milik A 500 karena B lebih dulu membuat PeriodReport bulan yang sama). **Jangan membuat user kedua sebelum C1 (Fase 4).** Endpoint register belum ada (F5), jadi aman by-construction.
  2. Baris yang dibuat kode lama/F1 setelah migrasi punya `userId` NULL (terbukti: PeriodReport dibuat oleh build F1). Wajib `node prisma/data-fixes/2026-10-multiuser-backfill-owner.js --apply` (lalu `verify-backfill.js`) tepat sebelum merge F2 dan sebelum C1.
  3. Skrip owner-backfill membaca `OWNER_FULL_NAME` dari `apps/backend/.env` lewat Prisma (dotenv) — hati-hati: di mesin dev ia menulis nama pemilik asli ke DB yang sedang dipakai.
  4. Prompt AI masih menyebut "Arzaka" dan parser masih memakai `OWNER_*` env (= F3). Karena itu fitur Gmail dikunci owner-only.
  5. `alertLog` create bisa bentrok (unik global date) jika user kedua over-budget di hari yang sama — pra-C1 juga.
- **Belum / tertunda:** P2-04 (cek saldo dua-user di DB → C1), P2-08 (`IngestPipelineService` → ditunda ke F6, YAGNI), P2-12 (golden dengan data nyata Arzaka + **verifikasi hidup di browser** belum — frontend tak berubah tapi `/gmail/auth-url` kini memberi `state`, dan Telegram/cron belum diuji langsung tanpa bot), P2-13 ⛔ merge.
- **Aksi untuk Arzaka:** tidak ada env baru. Saat siap merge: backup → P1-08 → backfill-owner `--apply` → F2.
- Docs: Roadmap (centang+catatan), 04-Checklist §B (matriks), Codemap.
- **Langkah berikutnya:** (1) Arzaka setujui P1/P8/P13 + lakukan P0-04..06 (VPS). (2) Verifikasi hidup F2 di browser dengan DB hasil restore. (3) F3 (konteks pemilik parser, Telegram bersama, nama di prompt) — butuh keputusan P2 (bot bersama).

## 2026-10-06 (malam) — merge main + F3 sebagian (P3-01..04, P3-08)
- Sesi oleh: Claude (Sonnet 5.5)   Branch: `feat/multi-user`
- Merge `main` ke branch (konflik frontend diselesaikan dgn versi `main`; `gmail.controller` = `state` OAuth + redirect `/app/settings`).
- Parser/registry/`income.classify` memakai `OwnerContext` eksplisit (nama+rekening dari DB per user); `parsers.check` 61 assertion lulus (+ user B & konteks kosong). `npm run check` 20/20 (dgn scratch DB), build bersih, `tsc` bersih.
- `/auth/me` memuat `displayName`/`role`/`onboardedAt`.
- **Belum:** P3-05 (bot Telegram bersama — butuh persetujuan P2), P3-06/07 (prompt AI "Arzaka", frontend nama hardcode), P3-09 verifikasi hidup, backfill-owner prod.
- Fallback env `OWNER_*` masih ada di satu tempat (`getOwnerContext`) agar Arzaka tidak berubah perilaku sebelum skrip backfill dijalankan.

## 2026-10-06 (malam, lanjutan) — P2 disetujui → F3 P3-05/06
- Arzaka menyetujui P2 (bot bersama). Diimplementasi backward-compatible: pemilik tetap jalan lewat `TelegramConfig` lama sampai ditautkan; token env `TELEGRAM_BOT_TOKEN` dipakai bila ada (**pastikan nilainya = token bot Arzaka di `.env` VPS sebelum deploy**, kalau tidak token config lama dipakai).
- `npm run check` 21/21, tenancy-audit 0, build bersih. **Belum diuji dengan bot Telegram sungguhan** (P3-09) dan belum di-push (menunggu backup prod + izin Arzaka).
- Sisa F3: P3-07 (prompt AI/nama hardcode frontend), P3-09, P3-10.

## 2026-10-06/07 — F3 selesai (kode) + F4 + C1 siap — sesi lanjutan ("lanjut sampai usage habis, push ke feat/multi-user")
- Sesi oleh: Claude (Sonnet 5.5)   Branch: `feat/multi-user` (di-push ke origin; **tidak** ke `main`, CD tidak jalan)
- **Selesai (terverifikasi di scratch Postgres 5434, bukan data nyata):**
  - P3-07: prompt AI per-user (`common/persona.ts`), wizard Split Bill pakai `/auth/me`, rekening contoh Arzaka tak lagi masuk state live. `tsc` backend & frontend bersih.
  - P4-01..03: runner `forEachActiveUser` (durasi/status, jitter 30 dtk untuk 7 job AI/Telegram), laporan periode tidak dibuat untuk periode sebelum user ada; `per-user.check.ts`.
  - **C1 (P4-07) siap**: migrasi `20261007100000_multiuser_contract` — backfill ulang di awal (idempoten) → `userId NOT NULL` ×23 tabel → unik global jadi komposit → PK `CategoryIcon (userId, category)` → `BudgetSetting.userId` unik. Disusun dari `prisma migrate diff` dikurangi drift raw-SQL lama. Diuji: DB berisi baris NULL (ter-backfill), DB kosong, deploy berurutan; `migrate diff` pasca-migrasi = 3 drift lama saja; `npm run check` 22/22; `tenancy-audit` 0; build bersih; `isolation-e2e` **169 lulus** dengan `ISO_PRE_C1=0` (tes baru: user B menulis kunci unik yang sama dgn A → sukses & A tak bergeser). Hazard "user kedua memblokir user pertama" (log 2026-10-06 F2) **hilang** setelah C1.
- **Belum / butuh Arzaka:** C1 belum diuji pada restore data nyata & belum di prod (⛔: backup → restore-drill → uji → baru deploy). P3-09/P3-10, P4-04 (menunggu O9), P4-06, P4-08. P0-04..06 (akses VPS) masih tertunda.
- Deviasi: `CategoryIcon`/`BudgetSetting` tidak diberi indeks komposit tambahan; composite index `[userId, occurredAt]` dst. ditunda (data kecil, YAGNI).
- Langkah berikutnya: F5 (auth & undangan) dikerjakan di branch memakai default P4/P14/O2 (CLI undangan, reset admin-issued, `MAX_USERS=10`) — **status P4/P14/O2 belum disetujui Arzaka**; kode mudah diubah.

## 2026-10-07 — F5 Auth & undangan (kode selesai, belum merge)
- Sesi oleh: Claude (Sonnet 5.5)   Branch: `feat/multi-user` (di-push)
- **Selesai:** P5-01..08 (lihat Roadmap). Backend: guard cek status+tokenVersion; `register`/`change-password`/`reset-password`/`logout-all`; rate limit khusus auth; CLI `prisma/user-admin.js`; `scripts/auth-e2e.mjs` 9 skenario lulus; `isolation-e2e` 169 lulus. Frontend: `/invite/[code]`, `/reset/[token]`, middleware; diverifikasi di browser (daftar → `/app` kosong; reset password).
- **Temuan penting:** `@nestjs/throttler` TIDAK dipakai untuk auth — `ThrottlerModule.forRoot` di `SplitBillModule` (5 per 10 menit) ikut terbaca `ThrottlerGuard` di controller lain sehingga login terbatasi 5/10 mnt/IP (terbukti: Retry-After ±600 dtk). Diganti guard sendiri. (Masalah serupa mungkin berlaku antar `split-bill`/`trip` — tidak diperiksa.) Juga ditambah `trust proxy 1` agar `req.ip` = IP klien di belakang Nginx (sebelumnya semua klien berbagi IP Nginx untuk throttle split-bill).
- **Keputusan memakai default yang BELUM disetujui Arzaka:** P4 (CLI undangan), P14 (reset admin-issued), O2 (`MAX_USERS`=10). Mudah diubah.
- **Env VPS (opsional):** `MAX_USERS`, pastikan `FRONTEND_URL` benar (dipakai CLI untuk URL undangan; default `https://trackster.dev`). Tes-only: `AUTH_CACHE_MS`, `AUTH_THROTTLE_LIMIT` — jangan diset di prod.
- **Efek ke Arzaka saat deploy:** cookie lama tetap valid (tv=0). `disable` via CLI efektif ≤30 dtk.
- Belum: UI ganti-password di Settings; keluar/masuk lagi di prod; P5-09 ⛔ merge/deploy; rotasi `JWT_SECRET` (menunggu F6).
- Langkah berikutnya: F6 (API token & ingest manual) — butuh jawaban O7 (perangkat tester) untuk bentuk akhir; kerangka `ApiToken` + `/ingest/transaction|income` dengan `Idempotency-Key` (P7) bisa dikerjakan tanpa O7.

## 2026-10-07 — F6 API token & ingest manual (kode selesai, belum merge) — sesi lanjutan ("lanjutin multi-user")
- Sesi oleh: Claude (Sonnet 5.5)   Branch: `feat/multi-user` (turunan `main`, di-push)   Commit: lihat `git log` ("F6 backend", "F6 frontend")
- Dasar: Arzaka minta lanjut di `feat/multi-user` dan membaca semua docs. Status awal: F0–F5 selesai di branch, **belum ada yang di `main`/prod**. Dikerjakan F6 memakai default P7 (`Idempotency-Key` wajib) — **P7 masih PROPOSED**, O7 (perangkat tester) belum dijawab → panduan Android = HTTP Shortcuts/Tasker generik.
- **Selesai (terverifikasi di scratch Postgres lokal, bukan data nyata):** P6-01, 02, 03, 07; P6-04 sebagian (panduan di app + Runbook §7b; *belum* ada berkas `.shortcut`/gambar langkah).
  - Backend: `modules/api-token` + `common/guards/api-token.guard.ts` + `modules/ingest`; `IncomeService.createQuick` menerima `{externalId, receivedAt, streamId}` (dedup + unik P2002).
  - Frontend: tab Shortcut (jalur resmi: edit `.dc.html` → `node scripts/dc-to-tsx.mjs` → `logic.tsx` → `useLive.ts`; regenerasi sebelum edit = nol diff, jadi diff hanya perubahan ini).
  - Verifikasi: `tsc` backend+frontend bersih; build backend bersih (`dist`+tsbuildinfo dihapus dulu) dan `next build` lolos; `npm run check` 24/24; `tenancy-audit` 0; `ingest-e2e` 18/18; `isolation-e2e` 113 lulus; browser (Chromium): alur buat→salin→pakai→cabut + mobile + /demo, console bersih kecuali 401 yang sengaja.
- **Temuan:** (1) env sesi cloud ini menyetel `COOKIE_DOMAIN=.track.trackster.my.id` & `FRONTEND_URL` domain lama → login lewat browser di localhost "berhasil 201 tapi tetap di /login"; jalankan backend uji dengan `COOKIE_DOMAIN=` kosong. (2) `.env.example`/docs masih menyebut domain lama di beberapa tempat (sebagian sudah dirapikan di F0). (3) Alert over-budget kini ada di dua tempat (Gmail sync + ingest) sampai Gmail dihapus (F7).
- **Belum / butuh Arzaka:** P6-04 (rancang & uji Shortcut sungguhan di iPhone), P6-05 (pindahkan Shortcut Arzaka → token baru), P6-06 (hapus `/income/quick` + rotasi `JWT_SECRET` — **urutannya setelah P6-05**), P6-08 ⛔ merge/deploy. Persetujuan P1/P4/P7/P8/P13/P14/O2 masih diminta.
- Env VPS baru: tidak ada (`INGEST_RATE_LIMIT` hanya untuk tes — jangan diset di prod).
- Docs diperbarui: Roadmap (F6 dicentang+catatan), 04-Checklist (baris ingest/api-tokens), 06-Runbooks §7b, Codemap, README (status).
- **Langkah berikutnya:** (1) Arzaka: coba tab Shortcut + buat Shortcut iPhone, jawab O7, setujui P7. (2) Setelah itu P6-05/06 (butuh akses VPS/ponsel). (3) Tanpa menunggu: F7 hanya bisa disiapkan sebagian (kode `/ingest/email` + parser MIME) tetapi butuh O1/O8 dan persetujuan DNS untuk sisanya.

## 2026-10-07 — Restore-drill + uji C1 pada data prod nyata (P0-04, P0-05, P1-05)
- Sesi oleh: Claude (Sonnet 5.5) + Arzaka   Branch: `feat/multi-user`
- Selesai: backup prod `backup-2026-10-07-1033.sql` (disalin ke laptop, 251 `Transaction` = prod). Restore ke Postgres scratch lokal (port 5434, DB `trackster_restore`).
- `prisma migrate deploy` (expand → backfill → budget_setting_id_sequence → contract) lolos di restore; `verify-backfill`: NULL = 0 di semua tabel, 1 user ADMIN memegang semua data.
- Verifikasi hidup (backend build bersih + frontend lokal ke restore): Arzaka login dan membandingkan dengan prod — saldo BCA/Jago, budget hari ini sama persis.
- Catatan: token Gmail/Telegram dihapus dari SALINAN restore sebelum backend dijalankan (cegah cron memakai kredensial asli). `BudgetSetting` kosong di data prod (bukan akibat migrasi). `pg_dump` baru menyisipkan `\unrestrict` yang tak dikenali psql — error tak berbahaya di akhir restore.
- Belum: P0-06 (cek `TELEGRAM_BOT_TOKEN` env VPS = token bot), merge/deploy ⛔, P6-05/06, rotasi `JWT_SECRET`.

## 2026-10-10 — Audit keamanan menyeluruh (branch `fix/security-audit` dari `origin/main`)
- Sesi oleh: Claude (Opus 5.5)   Branch: `fix/security-audit` (lokal, belum di-push) + 1 commit di `feat/multi-user` (HMAC inbound).
- Catatan status: `origin/main` (prod) ternyata sudah berisi F1–F6 + penghapusan `/income/quick`; `feat/multi-user` lokal tertinggal 5 commit.
- Selesai & terverifikasi (DB scratch lokal): 15 temuan diperbaiki — Next 15.5.27/React 19, Telegram config owner-only + UI kode tautan member,
  library Telegram → fetch, bcrypt 6, kuota AI per user, escape HTML Telegram, JWT purpose ditolak, kunci login 15 mnt, CSV injection,
  query parser simple, header keamanan, batas DTO publik, dll. Detail & bukti: [`09-Security-Audit.md`](09-Security-Audit.md).
- Tes baru: `scripts/security-e2e.mjs` (10/10), `report/csv.check.ts`. Regresi: check 25/25, tenancy 0, auth 9/9, ingest 18/18, isolasi 176/176.
- Butuh Arzaka: persetujuan merge `fix/security-audit` → `main`; R1 rotasi `JWT_SECRET`/`TELEGRAM_WEBHOOK_SECRET`; R4–R9 di dokumen audit.
